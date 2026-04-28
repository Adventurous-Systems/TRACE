/**
 * Blockchain anchoring worker.
 *
 * Flow:
 *   1. Receive { passportId, organisationId } from the anchor-passport BullMQ queue
 *   2. Load the full passport from the DB
 *   3. Serialise to canonical JSON-LD (keys sorted for reproducible hash)
 *   4. Compute keccak256 hash
 *   5. Submit to MaterialRegistry.registerPassport() on VeChainThor
 *   6. Poll for tx confirmation
 *   7. Write blockchain_tx_hash, blockchain_passport_hash, blockchain_anchored_at back to DB
 */

import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, materialPassports, type MaterialPassport } from '@trace/db';
import { createLogger } from '@trace/core';
import { ThorClient } from '@vechain/sdk-network';
import { Transaction } from '@vechain/sdk-core';
import { keccak256, Interface } from 'ethers';
import { env } from '../env.js';
import { redisConnection, type AnchorPassportJob } from '../lib/queue.js';

const logger = createLogger('anchor-worker');

// ─── VeChain setup ─────────────────────────────────────────────────────────

// Module-level singleton — one ThorClient per worker process
const thorClient = ThorClient.at(env.VECHAIN_NODE_URL);

// Minimal ABI for MaterialRegistry
const REGISTRY_ABI = [
  'function registerPassport(bytes32 passportId, bytes32 dataHash, string calldata metadataUri) external',
];

// ─── Canonical JSON-LD serialiser ──────────────────────────────────────────

function buildCanonicalJsonLd(passport: MaterialPassport): string {
  const doc = {
    '@context': [
      'https://schema.org/',
      'https://w3id.org/dpp/v1',
      'https://trace.construction/context/v1',
    ],
    '@type': 'MaterialPassport',
    '@id': `https://trace.construction/passport/${passport.id}`,
    id: passport.id,
    organisationId: passport.organisationId,
    productName: passport.productName,
    categoryL1: passport.categoryL1,
    categoryL2: passport.categoryL2 ?? null,
    gtin: passport.gtin ?? null,
    serialNumber: passport.serialNumber ?? null,
    materialComposition: passport.materialComposition,
    dimensions: passport.dimensions ?? null,
    technicalSpecs: passport.technicalSpecs,
    manufacturerName: passport.manufacturerName ?? null,
    countryOfOrigin: passport.countryOfOrigin ?? null,
    productionDate: (passport.productionDate as Date | null)?.toISOString() ?? null,
    gwpTotal: passport.gwpTotal ?? null,
    embodiedCarbon: passport.embodiedCarbon ?? null,
    recycledContent: passport.recycledContent ?? null,
    epdReference: passport.epdReference ?? null,
    ceMarking: passport.ceMarking,
    conditionGrade: passport.conditionGrade ?? null,
    conditionNotes: passport.conditionNotes ?? null,
    deconstructionDate: (passport.deconstructionDate as Date | null)?.toISOString() ?? null,
    deconstructionMethod: passport.deconstructionMethod ?? null,
    reclaimedBy: passport.reclaimedBy ?? null,
    remainingLifeEstimate: passport.remainingLifeEstimate ?? null,
    carbonSavingsVsNew: passport.carbonSavingsVsNew ?? null,
    hazardousSubstances: passport.hazardousSubstances,
    status: passport.status,
    createdAt: passport.createdAt.toISOString(),
  };

  // Sort keys to ensure hash is reproducible regardless of source insertion order
  const sorted = Object.fromEntries(
    Object.entries(doc).sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify(sorted);
}

// ─── UUID → bytes32 ───────────────────────────────────────────────────────

function uuidToBytes32(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  return '0x' + hex.padStart(64, '0');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main job processor ───────────────────────────────────────────────────

async function processAnchorJob(job: Job<AnchorPassportJob>): Promise<void> {
  const { passportId } = job.data;
  logger.info({ passportId, attempt: job.attemptsMade }, 'Processing anchor job');

  const passport = await db.query.materialPassports.findFirst({
    where: eq(materialPassports.id, passportId),
  });

  if (!passport) {
    logger.warn({ passportId }, 'Passport not found, skipping');
    return;
  }

  if (passport.blockchainTxHash && passport.blockchainAnchoredAt) {
    logger.info({ passportId }, 'Passport already anchored, skipping');
    return;
  }

  if (!env.MATERIAL_REGISTRY_ADDRESS) {
    throw new Error('MATERIAL_REGISTRY_ADDRESS is not set — cannot anchor passport');
  }

  if (!env.DEPLOYER_PRIVATE_KEY) {
    throw new Error('DEPLOYER_PRIVATE_KEY is not set — cannot anchor passport');
  }

  // Compute hash
  const jsonLd = buildCanonicalJsonLd(passport);
  const dataHashBytes = keccak256(Buffer.from(jsonLd, 'utf-8'));
  const passportIdBytes32 = uuidToBytes32(passportId);
  const metadataUri = passport.digitalLinkUri ?? `${env.API_URL}/api/v1/passports/${passportId}`;

  logger.info({ passportId, dataHashBytes }, 'Computed passport hash');

  // Encode call data
  const iface = new Interface(REGISTRY_ABI);
  const callData = iface.encodeFunctionData('registerPassport', [
    passportIdBytes32,
    dataHashBytes,
    metadataUri,
  ]);

  // Sign and submit via VeChain SDK
  const privKey = Buffer.from(env.DEPLOYER_PRIVATE_KEY.replace(/^0x/, ''), 'hex');

  try {
    const txBody = await thorClient.transactions.buildTransactionBody(
      [
        {
          to: env.MATERIAL_REGISTRY_ADDRESS,
          value: '0x0',
          data: callData,
        },
      ],
      500_000,
    );

    const signedTx = Transaction.of(txBody).sign(privKey);
    const rawTx = '0x' + Buffer.from(signedTx.encoded).toString('hex');

    const { id: txId } = await thorClient.transactions.sendRawTransaction(rawTx);
    logger.info({ passportId, txId }, 'Transaction submitted');

    // Poll for confirmation (up to 60s — VeChain block time ~10s; Solo: near-instant)
    let receipt = null;
    for (let i = 0; i < 12; i++) {
      try {
        receipt = await thorClient.transactions.getTransactionReceipt(txId);
        if (receipt) break;
      } catch {
        // not yet confirmed
      }
      await sleep(5000);
    }

    if (!receipt || receipt.reverted) {
      throw new Error(`Transaction ${txId} failed or was not confirmed in time`);
    }

    await db
      .update(materialPassports)
      .set({
        blockchainTxHash: txId,
        blockchainPassportHash: dataHashBytes,
        blockchainAnchoredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(materialPassports.id, passportId));

    logger.info({ passportId, txId, dataHashBytes }, 'Passport anchored successfully');
  } catch (err) {
    logger.error({ passportId, err }, 'Failed to anchor passport');
    throw err;
  }
}

// ─── Worker bootstrap ─────────────────────────────────────────────────────

export function startAnchorWorker() {
  const worker = new Worker<AnchorPassportJob>(
    'anchor-passport',
    processAnchorJob,
    {
      connection: redisConnection,
      concurrency: 3,
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, passportId: job.data.passportId }, 'Anchor job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, passportId: job?.data.passportId, err },
      'Anchor job failed',
    );
  });

  logger.info('Anchor passport worker started');
  return worker;
}
