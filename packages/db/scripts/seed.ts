import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import * as schema from '../drizzle/schema.js';

async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL environment variable is required');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  console.log('Seeding database...');

  // ── Organisation ────────────────────────────────────────────────────────────

  let org = await db.query.organisations.findFirst({
    where: eq(schema.organisations.slug, 'stirling'),
  });

  if (!org) {
    [org] = await db
      .insert(schema.organisations)
      .values({
        name: 'Stirling Reuse Hub',
        type: 'hub',
        slug: 'stirling',
        branding: {
          description:
            'Scotland\'s leading construction material reuse hub, based in Stirling.',
          primaryColour: '#2d6a4f',
        },
        verified: true,
      })
      .returning();
    console.log(`  ✓ Organisation created: ${org!.name}`);
  } else {
    console.log(`  – Organisation exists: ${org.name}`);
  }

  // ── Users ────────────────────────────────────────────────────────────────────

  const testUsers = [
    {
      email: 'admin@stirlingreuse.com',
      password: 'Admin1234!',
      name: 'Hub Admin',
      role: 'hub_admin' as const,
    },
    {
      email: 'staff@stirlingreuse.com',
      password: 'Staff1234!',
      name: 'Hub Staff',
      role: 'hub_staff' as const,
    },
    {
      email: 'inspector@trace.eco',
      password: 'Inspector1234!',
      name: 'Quality Inspector',
      role: 'inspector' as const,
    },
    {
      email: 'buyer@example.com',
      password: 'Buyer1234!',
      name: 'Test Buyer',
      role: 'buyer' as const,
    },
  ];

  const createdUsers: Record<string, typeof schema.users.$inferSelect> = {};

  for (const u of testUsers) {
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, u.email),
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      [user] = await db
        .insert(schema.users)
        .values({
          email: u.email,
          passwordHash,
          name: u.name,
          role: u.role,
          organisationId: ['hub_admin', 'hub_staff'].includes(u.role) ? org!.id : null,
        })
        .returning();
      console.log(`  ✓ User created: ${u.email} (${u.role})`);
    } else {
      console.log(`  – User exists: ${u.email}`);
    }
    createdUsers[u.role] = user!;
  }

  // ── Sample Passports ─────────────────────────────────────────────────────────

  const staffUser = createdUsers['hub_staff'];

  const staffId = staffUser?.id ?? null;

  const samplePassports: schema.NewMaterialPassport[] = [
    {
      organisationId: org!.id,
      registeredBy: staffId,
      productName: 'Reclaimed Victorian Red Brick',
      categoryL1: 'masonry',
      categoryL2: 'clay-brick',
      manufacturerName: 'Unknown (reclaimed)',
      countryOfOrigin: 'GB',
      ceMarking: false,
      conditionGrade: 'B',
      conditionNotes:
        'Good condition with mortar residue. Minor chipping on some units. Suitable for feature walls and garden use.',
      reuseCount: 1,
      deconstructionMethod: 'selective',
      carbonSavingsVsNew: '0.22',
      circularityScore: 85,
      reuseSuitability: ['feature-wall', 'garden-landscaping', 'internal-partition'],
      status: 'active',
      dimensions: { length: 215, width: 102, height: 65, unit: 'mm', weight: 2.5, weightUnit: 'kg' },
      gwpTotal: '0.22',
      customAttributes: { quantity_available: 500, lot_reference: 'SRH-2026-001' },
    },
    {
      organisationId: org!.id,
      registeredBy: staffId,
      productName: 'Steel I-Beam — 203 × 133 × 25 UB',
      categoryL1: 'structural-steel',
      categoryL2: 'i-beams',
      manufacturerName: 'Tata Steel (reclaimed)',
      countryOfOrigin: 'GB',
      ceMarking: false,
      conditionGrade: 'A',
      conditionNotes: 'Excellent condition. Paint coat intact, no corrosion visible. Full structural load data available.',
      reuseCount: 1,
      deconstructionMethod: 'selective',
      carbonSavingsVsNew: '1.85',
      circularityScore: 92,
      reuseSuitability: ['residential-frame', 'industrial-mezzanine', 'portal-frame'],
      handlingRequirements: 'Crane lift required. Minimum 2-person handling.',
      status: 'listed',
      dimensions: { length: 6000, unit: 'mm', weight: 150, weightUnit: 'kg' },
      gwpTotal: '0.30',
      customAttributes: { section_reference: '203x133x25 UB', length_mm: 6000 },
    },
    {
      organisationId: org!.id,
      registeredBy: staffId,
      productName: 'Natural Welsh Slate Roofing',
      categoryL1: 'roofing',
      categoryL2: 'natural-slate',
      manufacturerName: 'Welsh Slate (reclaimed)',
      countryOfOrigin: 'GB',
      ceMarking: false,
      conditionGrade: 'C',
      conditionNotes:
        'Fair condition. Mix of sizes 400mm × 200mm and 300mm × 200mm. Some surface weathering typical for age. Suitable for secondary roofing.',
      reuseCount: 2,
      deconstructionMethod: 'manual',
      carbonSavingsVsNew: '0.45',
      circularityScore: 70,
      reuseSuitability: ['secondary-roofing', 'garden-paving', 'feature-cladding'],
      status: 'draft',
      dimensions: { unit: 'mm' },
      gwpTotal: '0.05',
      customAttributes: { quantity_available: 300, average_size_mm: '400x200' },
    },
  ];

  for (const passport of samplePassports) {
    const existing = await db.query.materialPassports.findFirst({
      where: eq(schema.materialPassports.productName, passport.productName),
    });

    if (!existing) {
      const [created] = await db
        .insert(schema.materialPassports)
        .values(passport)
        .returning();
      console.log(`  ✓ Passport created: ${created!.productName}`);
    } else {
      console.log(`  – Passport exists: ${passport.productName}`);
    }
  }

  await client.end();
  console.log('\nSeed complete.');
  console.log('\nTest credentials:');
  console.log('  Hub Admin:   admin@stirlingreuse.com  / Admin1234!');
  console.log('  Hub Staff:   staff@stirlingreuse.com  / Staff1234!');
  console.log('  Inspector:   inspector@trace.eco       / Inspector1234!');
  console.log('  Buyer:       buyer@example.com         / Buyer1234!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
