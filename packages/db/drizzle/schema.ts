import {
  pgTable,
  text,
  uuid,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  date,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Organisations ────────────────────────────────────────────────────────────

export const organisations = pgTable(
  'organisations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: text('type').notNull(), // hub | manufacturer | contractor | certifier
    slug: text('slug').notNull(),
    branding: jsonb('branding').$type<Record<string, unknown>>().default({}),
    verified: boolean('verified').default(false).notNull(),
    blockchainAddress: text('blockchain_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('organisations_slug_unique').on(table.slug)],
);

export type Organisation = typeof organisations.$inferSelect;
export type NewOrganisation = typeof organisations.$inferInsert;

// ── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(), // platform_admin | hub_admin | hub_staff | supplier | buyer | inspector
    organisationId: uuid('organisation_id').references(() => organisations.id),
    blockchainAddress: text('blockchain_address'),
    notificationPrefs: jsonb('notification_prefs').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('users_email_unique').on(table.email)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ── Material Passports ───────────────────────────────────────────────────────

export const materialPassports = pgTable(
  'material_passports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),

    // EU DPP Identity
    gtin: text('gtin'),
    serialNumber: text('serial_number'),
    digitalLinkUri: text('digital_link_uri'),
    qrCodeUrl: text('qr_code_url'),

    // Product
    productName: text('product_name').notNull(),
    categoryL1: text('category_l1').notNull(),
    categoryL2: text('category_l2'),
    materialComposition: jsonb('material_composition')
      .$type<Array<{ material: string; percentage?: number; recycled?: boolean }>>()
      .default([]),
    dimensions: jsonb('dimensions').$type<{
      length?: number;
      width?: number;
      height?: number;
      weight?: number;
      unit: string;
      weightUnit?: string;
    }>(),
    technicalSpecs: jsonb('technical_specs').$type<Record<string, unknown>>().default({}),

    // Manufacturer / Source
    manufacturerName: text('manufacturer_name'),
    countryOfOrigin: text('country_of_origin'),
    productionDate: date('production_date', { mode: 'date' }),

    // Environmental
    gwpTotal: numeric('gwp_total'),           // kgCO2e
    embodiedCarbon: numeric('embodied_carbon'),
    recycledContent: numeric('recycled_content'), // percentage
    epdReference: text('epd_reference'),

    // Compliance
    ceMarking: boolean('ce_marking').default(false),
    declarationOfPerformance: text('declaration_of_performance'),
    harmonisedStandard: text('harmonised_standard'),

    // Circular Extension
    previousBuildingId: text('previous_building_id'),
    deconstructionDate: date('deconstruction_date', { mode: 'date' }),
    deconstructionMethod: text('deconstruction_method'), // selective | mechanical | manual | mixed
    reclaimedBy: text('reclaimed_by'),
    conditionGrade: text('condition_grade'),   // A | B | C | D
    conditionNotes: text('condition_notes'),
    conditionPhotos: jsonb('condition_photos').$type<string[]>().default([]),
    originalAge: integer('original_age'),
    remainingLifeEstimate: integer('remaining_life_estimate'),
    carbonSavingsVsNew: numeric('carbon_savings_vs_new'),
    circularityScore: integer('circularity_score'),
    reuseCount: integer('reuse_count').default(0).notNull(),
    reuseSuitability: jsonb('reuse_suitability').$type<string[]>().default([]),
    handlingRequirements: text('handling_requirements'),
    hazardousSubstances: jsonb('hazardous_substances')
      .$type<Array<{ name: string; casNumber?: string; concentration?: string; hazardClass?: string }>>()
      .default([]),

    // Flexible
    customAttributes: jsonb('custom_attributes').$type<Record<string, unknown>>().default({}),

    // Status
    status: text('status').notNull().default('draft'),
    // draft | active | listed | reserved | sold | installed | decommissioned

    // Blockchain anchoring
    blockchainTxHash: text('blockchain_tx_hash'),
    blockchainPassportHash: text('blockchain_passport_hash'),
    blockchainAnchoredAt: timestamp('blockchain_anchored_at', { withTimezone: true }),

    // Metadata
    registeredBy: uuid('registered_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_passports_org').on(table.organisationId),
    index('idx_passports_status').on(table.status),
    index('idx_passports_category').on(table.categoryL1, table.categoryL2),
    index('idx_passports_gtin').on(table.gtin),
    index('idx_passports_search').using(
      'gin',
      sql`to_tsvector('english', ${table.productName} || ' ' || coalesce(${table.categoryL1}, '') || ' ' || coalesce(${table.categoryL2}, '') || ' ' || coalesce(${table.conditionNotes}, ''))`,
    ),
  ],
);

export type MaterialPassport = typeof materialPassports.$inferSelect;
export type NewMaterialPassport = typeof materialPassports.$inferInsert;

// ── Passport Events (EPCIS) ──────────────────────────────────────────────────

export const passportEvents = pgTable(
  'passport_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passportId: uuid('passport_id')
      .notNull()
      .references(() => materialPassports.id),
    eventType: text('event_type').notNull(), // EPCIS 2.0 vocabulary
    eventData: jsonb('event_data').$type<Record<string, unknown>>().notNull(),
    actorId: uuid('actor_id').references(() => users.id),
    blockchainTxHash: text('blockchain_tx_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_passport_events_passport').on(table.passportId)],
);

export type PassportEvent = typeof passportEvents.$inferSelect;
export type NewPassportEvent = typeof passportEvents.$inferInsert;

// ── Listings ─────────────────────────────────────────────────────────────────

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passportId: uuid('passport_id')
      .notNull()
      .references(() => materialPassports.id),
    organisationId: uuid('organisation_id')
      .notNull()
      .references(() => organisations.id),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => users.id),
    pricePence: integer('price_pence').notNull(),
    currency: text('currency').default('GBP').notNull(),
    quantity: integer('quantity').default(1).notNull(),
    shippingOptions: jsonb('shipping_options')
      .$type<
        Array<{
          method: string;
          deliveryRadiusMiles?: number;
          deliveryCostPence?: number;
          notes?: string;
        }>
      >()
      .default([]),
    status: text('status').default('active').notNull(),
    // active | reserved | sold | expired | cancelled
    blockchainTxHash: text('blockchain_tx_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_listings_status').on(table.status),
    index('idx_listings_org').on(table.organisationId),
    index('idx_listings_passport').on(table.passportId),
  ],
);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

// ── Transactions ─────────────────────────────────────────────────────────────

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => users.id),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => users.id),
    amountPence: integer('amount_pence').notNull(),
    status: text('status').default('pending').notNull(),
    // pending | confirmed | disputed | resolved | completed | cancelled
    disputeDeadline: timestamp('dispute_deadline', { withTimezone: true }),
    blockchainTxHash: text('blockchain_tx_hash'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_transactions_listing').on(table.listingId),
    index('idx_transactions_buyer').on(table.buyerId),
    index('idx_transactions_status').on(table.status),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// ── Quality Reports ───────────────────────────────────────────────────────────

export const qualityReports = pgTable(
  'quality_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passportId: uuid('passport_id')
      .notNull()
      .references(() => materialPassports.id),
    inspectorId: uuid('inspector_id')
      .notNull()
      .references(() => users.id),
    structuralScore: integer('structural_score'),   // 1–10
    aestheticScore: integer('aesthetic_score'),     // 1–10
    environmentalScore: integer('environmental_score'), // 1–10
    overallGrade: text('overall_grade'),            // A | B | C | D
    reportNotes: text('report_notes'),
    photoUrls: jsonb('photo_urls').$type<string[]>().default([]),
    blockchainTxHash: text('blockchain_tx_hash'),
    disputed: boolean('disputed').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_quality_reports_passport').on(table.passportId),
    index('idx_quality_reports_inspector').on(table.inspectorId),
  ],
);

export type QualityReport = typeof qualityReports.$inferSelect;
export type NewQualityReport = typeof qualityReports.$inferInsert;

// ── Sensor Readings ───────────────────────────────────────────────────────────
// NOTE: In production, partition by RANGE (created_at) monthly.
// Partitioning is handled via raw SQL migration after initial schema creation.

export const sensorReadings = pgTable(
  'sensor_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passportId: uuid('passport_id').references(() => materialPassports.id),
    deviceId: text('device_id').notNull(),
    sensorType: text('sensor_type').notNull(),
    readingValue: jsonb('reading_value').$type<Record<string, unknown>>().notNull(),
    blockchainDataHash: text('blockchain_data_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_sensor_readings_passport').on(table.passportId),
    index('idx_sensor_readings_device').on(table.deviceId),
    index('idx_sensor_readings_created').on(table.createdAt),
  ],
);

export type SensorReading = typeof sensorReadings.$inferSelect;
export type NewSensorReading = typeof sensorReadings.$inferInsert;
