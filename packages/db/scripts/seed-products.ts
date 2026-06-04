/**
 * Curated product catalogue seeder for the TRACE Workshop showcase.
 *
 * Seeds a fixed set of material passports + active marketplace listings (with
 * real product photos uploaded to MinIO) so the marketplace, passport pages and
 * impact counter demo against authentic data. Each seeded passport is tagged
 * `customAttributes.seedSource = SEED_TAG` so the whole set can be removed again
 * with `--unseed` (the catalogue data lives here — not in the app — so it can be
 * re-seeded or torn down at will).
 *
 * Every passport gets a real keccak256 fingerprint recorded in the honest
 * "simulated / trust layer prepared" state (anchoredAt set, txHash null), so the
 * passport credential shows its verified seal and "Verify integrity" passes.
 *
 * Seller: the org of SELLER_EMAIL (default admin@stirlingreuse.com).
 *
 * Usage (env: DATABASE_URL + MINIO_* must point at the target stack):
 *   pnpm --filter @trace/db seed:products -- [--dry-run]
 *   pnpm --filter @trace/db seed:products -- --unseed --yes
 *
 * Images are read from packages/db/data/products/<image>.
 */
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql as dsql } from 'drizzle-orm';
import * as sha3 from 'js-sha3';
import * as Minio from 'minio';
import * as schema from '../drizzle/schema.js';
import type { MaterialPassport, NewMaterialPassport } from '../drizzle/schema.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..');
loadEnv({ path: path.resolve(PACKAGE_ROOT, '../../.env') });

const SEED_TAG = 'workshop-curated-2026-06';
const SELLER_EMAIL = (process.env['SEED_SELLER_EMAIL'] ?? 'admin@stirlingreuse.com').toLowerCase();
const PRODUCTS_DIR = path.resolve(PACKAGE_ROOT, 'data/products');
const DAY = 24 * 60 * 60 * 1000;

// ── Catalogue (the "data, in a script" the workshop can re-seed / remove) ──────
type SeedPassport = Omit<NewMaterialPassport, 'organisationId' | 'registeredBy' | 'conditionPhotos'>;
interface Product {
  image: string;
  passport: SeedPassport;
  listing: { pricePence: number; quantity: number; note?: string };
}

const RECLAIMED = {
  deconstructionMethod: 'selective',
  reclaimedBy: 'Stirling Community Reuse Hub',
  deconstructionDate: new Date(Date.now() - 120 * DAY),
} as const;

const CATALOG: Product[] = [
  {
    image: 'kbriq-medero-dark-grey.jpg',
    passport: {
      productName: 'K-BRIQ® — Medero Dark Grey',
      categoryL1: 'masonry',
      categoryL2: 'facing-brick',
      status: 'listed',
      manufacturerName: 'Kenoteq',
      countryOfOrigin: 'GB',
      productionDate: new Date(Date.now() - 30 * DAY),
      materialComposition: [
        { material: 'Recycled construction & demolition aggregate', percentage: 90, recycled: true },
        { material: 'Recycled gypsum (plasterboard)', percentage: 6, recycled: true },
        { material: 'Recycled pigment', percentage: 4, recycled: true },
      ],
      dimensions: { length: 215, width: 102.5, height: 65, weight: 2.4, unit: 'mm', weightUnit: 'kg' },
      technicalSpecs: {
        compressiveStrength: '30 N/mm²',
        waterAbsorption: '2% by weight',
        thermalConductivity: '0.74 W/mK',
        durability: 'F2',
        reactionToFire: 'A2-s1,d0',
        certification: 'BBA 25/7367',
      },
      embodiedCarbon: '0.02',
      recycledContent: '96',
      carbonSavingsVsNew: '0.49',
      conditionGrade: 'A',
      conditionNotes: 'New low-carbon brick — over 96% recycled content, <20g CO₂e embodied per unit.',
      remainingLifeEstimate: 100,
      circularityScore: 96,
      reuseSuitability: ['Facing brickwork', 'Internal walls', 'Landscaping'],
      ceMarking: true,
    },
    listing: { pricePence: 360, quantity: 5000, note: 'From £3.60 each — order quantity by arrangement.' },
  },
  {
    image: 'sisalwool-100.jpg',
    passport: {
      productName: 'Sisalwool 100 — Natural Fibre Insulation',
      categoryL1: 'insulation',
      categoryL2: 'natural-fibre',
      status: 'listed',
      manufacturerName: 'Sisalwool',
      countryOfOrigin: 'GB',
      productionDate: new Date(Date.now() - 20 * DAY),
      materialComposition: [
        { material: 'Sisal fibre (recycled coffee sacks)', percentage: 60, recycled: true },
        { material: 'Sheep wool (textile-industry surplus)', percentage: 40, recycled: true },
      ],
      dimensions: { length: 1200, width: 570, height: 100, unit: 'mm' },
      technicalSpecs: {
        thickness: '100mm',
        widths: '370mm / 570mm',
        acoustic: 'Class A sound absorption',
        reactionToFire: 'Euroclass E',
        breathability: 'Absorbs up to 30% of its weight in moisture',
        pestResistance: 'Long-lasting moth deterrent',
      },
      recycledContent: '90',
      carbonSavingsVsNew: '8',
      conditionGrade: 'A',
      conditionNotes: 'New breathable natural-fibre insulation from recycled coffee sacks and surplus wool.',
      remainingLifeEstimate: 60,
      circularityScore: 90,
      reuseSuitability: ['Walls', 'Floors', 'Roofs', 'Acoustic lining'],
      ceMarking: true,
    },
    listing: { pricePence: 8200, quantity: 250, note: 'From £82 per pack — order quantity by arrangement.' },
  },
  {
    image: 'aerated-concrete-blocks.jpg',
    passport: {
      productName: 'Reclaimed Aerated Concrete Blocks',
      categoryL1: 'masonry',
      categoryL2: 'aac-block',
      status: 'listed',
      countryOfOrigin: 'GB',
      ...RECLAIMED,
      materialComposition: [{ material: 'Autoclaved aerated concrete', percentage: 100 }],
      technicalSpecs: { type: 'AAC / aircrete block', grade: 'B' },
      carbonSavingsVsNew: '2.5',
      conditionGrade: 'B',
      conditionNotes: 'Reclaimed aircrete blocks in good reusable condition. B grade.',
      remainingLifeEstimate: 50,
      circularityScore: 85,
      reuseSuitability: ['Internal partitions', 'Infill walls'],
    },
    listing: { pricePence: 150, quantity: 30 },
  },
  {
    image: 'concrete-lintels.jpg',
    passport: {
      productName: 'Reclaimed Concrete Lintels',
      categoryL1: 'masonry',
      categoryL2: 'lintel',
      status: 'listed',
      countryOfOrigin: 'GB',
      ...RECLAIMED,
      materialComposition: [{ material: 'Pre-stressed concrete', percentage: 100 }],
      technicalSpecs: { description: '12 lintels circa 1.2m; 2 lintels circa 2m' },
      carbonSavingsVsNew: '30',
      conditionGrade: 'B',
      conditionNotes: '12 concrete lintels circa 1.2m and 2 concrete lintels circa 2m.',
      remainingLifeEstimate: 60,
      circularityScore: 88,
      reuseSuitability: ['Door & window openings'],
    },
    listing: { pricePence: 1000, quantity: 14 },
  },
  {
    image: 'facing-bricks.jpg',
    passport: {
      productName: 'Reclaimed Facing Bricks',
      categoryL1: 'masonry',
      categoryL2: 'facing-brick',
      status: 'listed',
      countryOfOrigin: 'GB',
      ...RECLAIMED,
      materialComposition: [{ material: 'Fired clay', percentage: 100 }],
      technicalSpecs: { type: 'Perforated facing brick', grade: 'B' },
      carbonSavingsVsNew: '0.5',
      conditionGrade: 'B',
      conditionNotes: 'Reclaimed perforated facing bricks, cleaned and palletised. B grade.',
      remainingLifeEstimate: 80,
      circularityScore: 90,
      reuseSuitability: ['Facing brickwork', 'Feature walls'],
    },
    listing: { pricePence: 100, quantity: 150 },
  },
  {
    image: 'prefabricated-staircase.jpg',
    passport: {
      productName: 'Reclaimed Prefabricated Staircase',
      categoryL1: 'structural-timber',
      categoryL2: 'softwood',
      status: 'listed',
      countryOfOrigin: 'GB',
      ...RECLAIMED,
      materialComposition: [{ material: 'Softwood timber', percentage: 100 }],
      dimensions: { length: 1720, height: 2450, unit: 'mm' },
      technicalSpecs: {
        treadDepth: '270mm',
        riserHeight: '170mm',
        steps: '13',
        height: '2.45m',
        length: '1.72m',
        angle: '55°',
      },
      carbonSavingsVsNew: '80',
      conditionGrade: 'B',
      conditionNotes: 'Prefabricated timber staircase. Tread depth 270mm, riser 170mm, 13 steps, 55° angle.',
      remainingLifeEstimate: 40,
      circularityScore: 82,
      reuseSuitability: ['Residential stair', 'Mezzanine access'],
    },
    listing: { pricePence: 15000, quantity: 2 },
  },
  {
    image: 'aluminium-stud-walling.jpg',
    passport: {
      productName: 'Reclaimed Aluminium Stud Walling',
      categoryL1: 'structural-steel',
      categoryL2: 'channels',
      status: 'listed',
      countryOfOrigin: 'GB',
      ...RECLAIMED,
      reclaimedBy: 'Reconditioning partners',
      materialComposition: [{ material: 'Aluminium', percentage: 100, recycled: true }],
      technicalSpecs: { type: 'Metal stud partition framing', source: 'Excess from reconditioning partners' },
      carbonSavingsVsNew: '12',
      conditionGrade: 'B',
      conditionNotes: 'Excess aluminium stud walling from reconditioning partners. Unused surplus.',
      remainingLifeEstimate: 30,
      circularityScore: 92,
      reuseSuitability: ['Partition framing', 'Drylining'],
    },
    listing: { pricePence: 100, quantity: 18 },
  },
];

// ── Canonical fingerprint (kept byte-identical to packages/api passport-hash) ──
function buildCanonicalJsonLd(passport: MaterialPassport): string {
  const doc = {
    '@context': ['https://schema.org/', 'https://w3id.org/dpp/v1', 'https://trace.construction/context/v1'],
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
  const sorted = Object.fromEntries(Object.entries(doc).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify(sorted);
}
const computeHash = (p: MaterialPassport): string => '0x' + sha3.keccak256(buildCanonicalJsonLd(p));

// ── MinIO ─────────────────────────────────────────────────────────────────────
function makeMinio() {
  const bucket = process.env['MINIO_BUCKET_PASSPORTS'] ?? 'passports';
  const publicUrl =
    process.env['MINIO_PUBLIC_URL'] ??
    `http://${process.env['MINIO_ENDPOINT'] ?? 'localhost'}:${process.env['MINIO_PORT'] ?? '9000'}`;
  const client = new Minio.Client({
    endPoint: process.env['MINIO_ENDPOINT'] ?? 'localhost',
    port: Number(process.env['MINIO_PORT'] ?? 9000),
    useSSL: (process.env['MINIO_USE_SSL'] ?? 'false') === 'true',
    accessKey: process.env['MINIO_ACCESS_KEY'] ?? 'minioadmin',
    secretKey: process.env['MINIO_SECRET_KEY'] ?? 'minioadmin',
  });
  return { client, bucket, publicUrl };
}

async function uploadImage(
  minio: ReturnType<typeof makeMinio>,
  passportId: string,
  imageFile: string,
): Promise<string> {
  const buffer = readFileSync(path.join(PRODUCTS_DIR, imageFile));
  const key = `passports/${passportId}/photos/${Date.now()}.jpg`;
  await minio.client.putObject(minio.bucket, key, buffer, buffer.length, { 'Content-Type': 'image/jpeg' });
  return `${minio.publicUrl}/${minio.bucket}/${key}`;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const unseed = argv.includes('--unseed');
  const confirmed = argv.includes('--yes');

  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL environment variable is required');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });
  const seedTagFilter = dsql`${schema.materialPassports.customAttributes}->>'seedSource' = ${SEED_TAG}`;

  try {
    // ── Unseed ────────────────────────────────────────────────────────────
    if (unseed) {
      const existing = await db
        .select({ id: schema.materialPassports.id, name: schema.materialPassports.productName })
        .from(schema.materialPassports)
        .where(seedTagFilter);
      console.log(`\nUnseed — ${existing.length} curated passport(s) tagged "${SEED_TAG}"`);
      for (const p of existing) console.log(`  - ${p.name}`);
      if (!existing.length) return;
      if (!confirmed) {
        console.error('\nRefusing to delete without --yes.');
        process.exit(1);
      }
      // listings cascade from passports (onDelete: cascade)
      await db.delete(schema.materialPassports).where(seedTagFilter);
      console.log(`\nRemoved ${existing.length} curated passport(s) and their listings.`);
      return;
    }

    // ── Seed ──────────────────────────────────────────────────────────────
    const seller = await db.query.users.findFirst({ where: eq(schema.users.email, SELLER_EMAIL) });
    if (!seller || !seller.organisationId) {
      throw new Error(`Seller ${SELLER_EMAIL} not found or has no organisation. Set SEED_SELLER_EMAIL.`);
    }
    const org = await db.query.organisations.findFirst({
      where: eq(schema.organisations.id, seller.organisationId),
    });
    console.log(`\nSeed products — ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
    console.log(`  seller: ${seller.email} · org: ${org?.name ?? seller.organisationId}\n`);

    const already = await db.select({ c: dsql<number>`count(*)::int` }).from(schema.materialPassports).where(seedTagFilter);
    if ((already[0]?.c ?? 0) > 0) {
      console.log(`  ${already[0]!.c} curated passport(s) already present — run with --unseed --yes first to reset.`);
      if (!dryRun) return;
    }

    const minio = dryRun ? null : makeMinio();

    for (const product of CATALOG) {
      if (dryRun) {
        console.log(`  ✓ would seed: ${product.passport.productName}  £${(product.listing.pricePence / 100).toFixed(2)} ×${product.listing.quantity}`);
        continue;
      }

      const [inserted] = await db
        .insert(schema.materialPassports)
        .values({
          ...product.passport,
          organisationId: seller.organisationId,
          registeredBy: seller.id,
          conditionPhotos: [],
          customAttributes: { seedSource: SEED_TAG },
        })
        .returning();

      // Upload photo (excluded from the fingerprint, so order vs hashing is irrelevant).
      const photoUrl = await uploadImage(minio!, inserted!.id, product.image);
      await db
        .update(schema.materialPassports)
        .set({ conditionPhotos: [photoUrl] })
        .where(eq(schema.materialPassports.id, inserted!.id));

      // Compute the fingerprint from a fresh read (jsonb-normalised, exactly what
      // verify-integrity will recompute) and record the simulated trust state.
      const fresh = await db.query.materialPassports.findFirst({
        where: eq(schema.materialPassports.id, inserted!.id),
      });
      await db
        .update(schema.materialPassports)
        .set({ blockchainPassportHash: computeHash(fresh!), blockchainAnchoredAt: new Date(), blockchainTxHash: null })
        .where(eq(schema.materialPassports.id, inserted!.id));

      await db.insert(schema.listings).values({
        passportId: inserted!.id,
        organisationId: seller.organisationId,
        sellerId: seller.id,
        pricePence: product.listing.pricePence,
        currency: 'GBP',
        quantity: product.listing.quantity,
        status: 'active',
        shippingOptions: [{ method: 'both', notes: product.listing.note ?? 'Delivery from FK7 or collection' }],
        expiresAt: new Date(Date.now() + 90 * DAY),
      });

      console.log(`  ✓ seeded: ${product.passport.productName}`);
    }

    if (dryRun) console.log('\nDry run complete — re-run without --dry-run to apply.');
    else console.log(`\nSeeded ${CATALOG.length} products with photos + listings under ${org?.name ?? seller.email}.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Product seed failed:', err);
  process.exit(1);
});
