/**
 * Blockchain anchoring worker.
 *
 * Flow:
 *   1. Receive { passportId } from the anchor-passport BullMQ queue
 *   2. Load the full passport from the DB
 *   3. Serialise to canonical JSON-LD
 *   4. Compute keccak256 hash
 *   5. Submit to MaterialRegistry.registerPassport() on VeChainThor
 *      — uses VIP-191 fee delegation when FEE_DELEGATOR_URL is set
 *   6. Poll for tx confirmation
 *   7. Write blockchain_tx_hash, blockchain_passport_hash, blockchain_anchored_at back to DB
 */

import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, materialPassports, type MaterialPassport } from '@trace/db';
import { createLogger } from '@trace/core';
import { ThorClient } from '@vechain/sdk-network';
import { Transaction, Address, Hex } from '@vechain/sdk-core';
import { keccak256, Interface } from 'ethers';
import { env } from '../env.js';
import { redisConnection, type AnchorPassportJob } from '../lib/queue.js';

const logger = createLogger('anchor-worker');

// ─── VeChain setup ─────────────────────────────────────────────────────────

function getThorClient() {
  return ThorClient.at(env.VECHAIN_NODE_URL);
}

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

  return JSON.stringify(doc);
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
    throw new Error('MATERIAL_REGISTRY_ADDRESS is not configured — blockchain anchoring cannot proceed');
  }

  const deployerPrivKeyRaw = process.env['DEPLOYER_PRIVATE_KEY'];
  if (!deployerPrivKeyRaw) {
    throw new Error('DEPLOYER_PRIVATE_KEY is not configured — blockchain anchoring cannot proceed');
  }

  // Convert hex private key to bytes
  const privKeyHex = deployerPrivKeyRaw.startsWith('0x') ? deployerPrivKeyRaw.slice(2) : deployerPrivKeyRaw;
  const senderPrivKeyBytes = Hex.of(privKeyHex).bytes;
  const senderAddress = Address.ofPrivateKey(senderPrivKeyBytes).toString();

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

  const clauses = [
    {
      to: env.MATERIAL_REGISTRY_ADDRESS,
      value: '0x0',
      data: callData,
    },
  ];

  const thorClient = getThorClient();
  const isDelegated = !!env.FEE_DELEGATOR_URL;

  try {
    // Estimate gas for accurate fee calculation
    const gasEstimate = await thorClient.transactions.estimateGas(clauses, senderAddress);
    const gasWithBuffer = Math.ceil(gasEstimate.totalGas * 1.2); // 20% buffer

    // Build transaction body
    const txBody = await thorClient.transactions.buildTransactionBody(
      clauses,
      gasWithBuffer,
      { isDelegated },
    );

    // Create transaction and sign as sender
    const tx = Transaction.of(txBody);
    const senderSignedTx = tx.signAsSender(senderPrivKeyBytes);

    let finalTx: Transaction;

    if (isDelegated && env.FEE_DELEGATOR_URL) {
      // VIP-191: get gas payer signature from remote delegator
      const rawUnsignedTx = '0x' + Buffer.from(tx.encoded).toString('hex');

      const delegatorResponse = await fetch(env.FEE_DELEGATOR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: rawUnsignedTx, origin: senderAddress }),
      });

      if (!delegatorResponse.ok) {
        const body = await delegatorResponse.text();
        throw new Error(`Fee delegator returned ${delegatorResponse.status}: ${body}`);
      }

      const { signature: gasPayerSigHex } = await delegatorResponse.json() as { signature: string };

      // Combine sender sig (65 bytes) + gas payer sig (65 bytes)
      const senderSig = senderSignedTx.signature!;
      const gasPayerSigClean = gasPayerSigHex.startsWith('0x') ? gasPayerSigHex.slice(2) : gasPayerSigHex;
      const gasPayerSig = Hex.of(gasPayerSigClean).bytes;
      const combinedSig = new Uint8Array([...senderSig, ...gasPayerSig]);

      finalTx = Transaction.of(txBody, combinedSig);
      logger.info({ passportId, delegatorUrl: env.FEE_DELEGATOR_URL }, 'Fee delegation applied');
    } else {
      finalTx = senderSignedTx;
    }

    const rawFinalTx = '0x' + Buffer.from(finalTx.encoded).toString('hex');
    const { id: txId } = await thorClient.transactions.sendRawTransaction(rawFinalTx);
    logger.info({ passportId, txId }, 'Transaction submitted');

    // Poll for confirmation (up to 60s)
    let receipt = null;
    for (let i = 0; i < 12; i++) {
      await sleep(5000);
      try {
        receipt = await thorClient.transactions.getTransactionReceipt(txId);
        if (receipt) break;
      } catch {
        // not yet confirmed
      }
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

// ─── Startup validation ───────────────────────────────────────────────────

function validateAnchorConfig(): void {
  if (!env.MATERIAL_REGISTRY_ADDRESS) return; // anchoring disabled — fine
  if (!env.VECHAIN_NODE_URL) throw new Error('VECHAIN_NODE_URL is required when MATERIAL_REGISTRY_ADDRESS is set');
  if (!process.env['DEPLOYER_PRIVATE_KEY']) throw new Error('DEPLOYER_PRIVATE_KEY is required when MATERIAL_REGISTRY_ADDRESS is set');
}

// ─── Worker bootstrap ─────────────────────────────────────────────────────

export function startAnchorWorker() {
  validateAnchorConfig();

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

  logger.info({ delegationEnabled: !!env.FEE_DELEGATOR_URL }, 'Anchor passport worker started');
  return worker;
}
