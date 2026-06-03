/**
 * Canonical passport fingerprinting.
 *
 * Produces a reproducible keccak256 "digital fingerprint" of a material
 * passport's substantive data (keys sorted for determinism). Photos are
 * intentionally excluded, so a passport's fingerprint is stable whether or
 * not condition photos are attached later.
 *
 * Shared by the on-chain anchoring worker and the demo simulation path so both
 * compute an identical hash.
 */
import { keccak256 } from 'ethers';
import type { MaterialPassport } from '@trace/db';

export function buildCanonicalJsonLd(passport: MaterialPassport): string {
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

  // Sort keys so the hash is reproducible regardless of source insertion order.
  const sorted = Object.fromEntries(
    Object.entries(doc).sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify(sorted);
}

export function computePassportHash(passport: MaterialPassport): string {
  return keccak256(Buffer.from(buildCanonicalJsonLd(passport), 'utf-8'));
}
