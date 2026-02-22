export { db } from './client.js';
export type { Db } from './client.js';

export {
  organisations,
  users,
  materialPassports,
  passportEvents,
  listings,
  transactions,
  qualityReports,
  sensorReadings,
} from '../drizzle/schema.js';

export type {
  Organisation,
  NewOrganisation,
  User,
  NewUser,
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
} from '../drizzle/schema.js';
