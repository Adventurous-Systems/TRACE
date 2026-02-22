export const PASSPORT_STATUSES = [
  'draft',
  'active',
  'listed',
  'reserved',
  'sold',
  'installed',
  'decommissioned',
] as const;

export const CONDITION_GRADES = ['A', 'B', 'C', 'D'] as const;

export const DECONSTRUCTION_METHODS = [
  'selective',
  'mechanical',
  'manual',
  'mixed',
] as const;

export const USER_ROLES = [
  'platform_admin',
  'hub_admin',
  'hub_staff',
  'supplier',
  'buyer',
  'inspector',
] as const;

export const ORGANISATION_TYPES = [
  'hub',
  'manufacturer',
  'contractor',
  'certifier',
] as const;

export const LISTING_STATUSES = [
  'active',
  'reserved',
  'sold',
  'expired',
  'cancelled',
] as const;

export const TRANSACTION_STATUSES = [
  'pending',
  'confirmed',
  'disputed',
  'resolved',
  'completed',
  'cancelled',
] as const;

// GS1 company prefix for prototype (not a real GS1 licence)
export const PROTOTYPE_GS1_PREFIX = '0000000';

// CBT reward amounts (in whole tokens, 18 decimals on-chain)
export const CBT_REWARDS = {
  REGISTER_PASSPORT: 10,
  SUBMIT_QUALITY_REPORT: 5,
  COMPLETE_TRANSACTION: 2,
  REFER_HUB: 50,
} as const;

// Staking / governance thresholds
export const GOVERNANCE = {
  MIN_CBT_TO_PROPOSE: 100,
  VOTING_PERIOD_DAYS: 7,
  QUORUM_PERCENT: 10,
  DISPUTE_WINDOW_HOURS: 48,
} as const;

// Blockchain anchoring
export const BLOCKCHAIN = {
  MAX_ANCHOR_RETRIES: 3,
  ANCHOR_RETRY_DELAY_MS: 5_000,
  TX_CONFIRMATION_TIMEOUT_MS: 60_000,
} as const;

// Condition grade descriptions
export const CONDITION_GRADE_LABELS: Record<string, string> = {
  A: 'Excellent — as new, no visible wear',
  B: 'Good — minor wear, fully functional',
  C: 'Fair — moderate wear, may need minor repair',
  D: 'Poor — significant wear, requires assessment',
};
