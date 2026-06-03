export { db } from './client.js';
export type { Db } from './client.js';

export {
  organisations,
  users,
  betaAccessRequests,
  materialPassports,
  passportEvents,
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
