export { db } from './client.js';
export type { Db } from './client.js';

export {
  organisations,
  users,
  betaAccessRequests,
  materialPassports,
  passportEvents,
  auditEvents,
  blockchainTransactions,
  listings,
  transactions,
  qualityReports,
  sensorReadings,
  feedbackSubmissions,
} from '../drizzle/schema.js';

export type {
  Organisation,
  NewOrganisation,
  User,
  NewUser,
  BetaAccessRequest,
  NewBetaAccessRequest,
  MaterialPassport,
  NewMaterialPassport,
  PassportEvent,
  NewPassportEvent,
  AuditEvent,
  NewAuditEvent,
  BlockchainTransaction,
  NewBlockchainTransaction,
  Listing,
  NewListing,
  Transaction,
  NewTransaction,
  QualityReport,
  NewQualityReport,
  SensorReading,
  NewSensorReading,
  FeedbackSubmission,
  NewFeedbackSubmission,
} from '../drizzle/schema.js';
