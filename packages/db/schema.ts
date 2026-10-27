import { pgTable, serial, text, timestamp, uuid, varchar, jsonb, integer, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// NextAuth adapter tables
export const accounts = pgTable('accounts', {
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 50 }),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => ({
  providerAccountIdIdx: index('accounts_provider_account_id_idx').on(table.providerAccountId),
  userIdIdx: index('accounts_user_id_idx').on(table.userId),
}));

export const sessions = pgTable('sessions', {
  sessionToken: varchar('session_token', { length: 255 }).notNull().primaryKey(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
}));

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().primaryKey(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (table) => ({
  identifierTokenIdx: index('verification_tokens_identifier_token_idx').on(table.identifier, table.token),
}));

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  emailVerified: timestamp('emailVerified'),
  image: varchar('image', { length: 500 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));

// Organizations table
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('organizations_slug_idx').on(table.slug),
}));

// Memberships table (users <-> organizations)
export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orgId: uuid('orgId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50, enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('memberships_user_id_idx').on(table.userId),
  orgIdIdx: index('memberships_org_id_idx').on(table.orgId),
  uniqueMembership: index('memberships_user_org_unique').on(table.userId, table.orgId),
}));

// Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('orgId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  status: varchar('status', { length: 50, enum: ['active', 'trialing', 'past_due', 'canceled', 'unpaid'] }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  orgIdIdx: index('subscriptions_org_id_idx').on(table.orgId),
  stripeSubIdx: index('subscriptions_stripe_sub_idx').on(table.stripeSubscriptionId),
}));

// Entitlements usage tracking
export const entitlementsUsage = pgTable('entitlements_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('orgId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  metric: varchar('metric', { length: 100 }).notNull(), // e.g., 'exports_per_month', 'ai_credits', 'keyword_lookups_per_day'
  period: varchar('period', { length: 20, enum: ['daily', 'monthly'] }).notNull(),
  periodStart: timestamp('period_start').notNull(),
  count: integer('count').notNull().default(0),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  orgMetricPeriodIdx: index('entitlements_org_metric_period_idx').on(table.orgId, table.metric, table.period, table.periodStart),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  subscriptions: many(subscriptions),
  entitlementsUsage: many(entitlementsUsage),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.orgId],
    references: [organizations.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.orgId],
    references: [organizations.id],
  }),
}));

export const entitlementsUsageRelations = relations(entitlementsUsage, ({ one }) => ({
  organization: one(organizations, {
    fields: [entitlementsUsage.orgId],
    references: [organizations.id],
  }),
}));

// Keyword cache table
export const keywordCache = pgTable('keyword_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('orgId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  keyword: varchar('keyword', { length: 255 }).notNull(),
  marketplace: varchar('marketplace', { length: 10, enum: ['US', 'UK', 'DE', 'FR', 'ES', 'IT', 'JP'] }).notNull().default('US'),
  volume: integer('volume'),
  competition: decimal('competition', { precision: 5, scale: 2 }),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  orgKeywordMarketIdx: index('keyword_cache_org_keyword_market_idx').on(table.orgId, table.keyword, table.marketplace),
  expiresAtIdx: index('keyword_cache_expires_at_idx').on(table.expiresAt),
}));

// Niche snapshots table
export const nicheSnapshots = pgTable('niche_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('orgId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  keyword: varchar('keyword', { length: 255 }).notNull(),
  marketplace: varchar('marketplace', { length: 10, enum: ['US', 'UK', 'DE', 'FR', 'ES', 'IT', 'JP'] }).notNull().default('US'),
  topResults: jsonb('top_results').notNull(), // Top 20 results with ASIN, BSR, price, reviews
  score: decimal('score', { precision: 5, scale: 2 }),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
}, (table) => ({
  orgKeywordIdx: index('niche_snapshots_org_keyword_idx').on(table.orgId, table.keyword),
}));

// BSR curves table (stores parameters for sales estimation model per category)
export const bsrCurves = pgTable('bsr_curves', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: varchar('category', { length: 255 }).notNull(),
  marketplace: varchar('marketplace', { length: 10, enum: ['US', 'UK', 'DE', 'FR', 'ES', 'IT', 'JP'] }).notNull().default('US'),
  params: jsonb('params').notNull(), // { a, b } for sales = a * BSR^(-b)
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  categoryMarketIdx: index('bsr_curves_category_market_idx').on(table.category, table.marketplace),
}));

// Saved niches table
export const savedNiches = pgTable('saved_niches', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('orgId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  keyword: varchar('keyword', { length: 255 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('saved_niches_org_idx').on(table.orgId),
}));

// Relations for keyword tables
export const keywordCacheRelations = relations(keywordCache, ({ one }) => ({
  organization: one(organizations, {
    fields: [keywordCache.orgId],
    references: [organizations.id],
  }),
}));

export const nicheSnapshotsRelations = relations(nicheSnapshots, ({ one }) => ({
  organization: one(organizations, {
    fields: [nicheSnapshots.orgId],
    references: [organizations.id],
  }),
}));

export const savedNichesRelations = relations(savedNiches, ({ one }) => ({
  organization: one(organizations, {
    fields: [savedNiches.orgId],
    references: [organizations.id],
  }),
}));

// Projects table
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('orgId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50, enum: ['book', 'puzzle_book', 'journal'] }).notNull(),
  trimSize: varchar('trim_size', { length: 50 }).notNull(), // e.g., '6x9', '8.5x11'
  pageCount: integer('page_count').notNull(),
  paper: varchar('paper', { length: 50, enum: ['white', 'cream', 'color'] }).notNull().default('white'),
  status: varchar('status', { length: 50, enum: ['draft', 'exporting', 'completed', 'failed'] }).notNull().default('draft'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('projects_org_idx').on(table.orgId),
}));

// Project documents table (stores cover/interior JSON state)
export const projectDocs = pgTable('project_docs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 50, enum: ['cover', 'interior'] }).notNull(),
  jsonState: jsonb('json_state').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  projectIdx: index('project_docs_project_idx').on(table.projectId),
  kindIdx: index('project_docs_kind_idx').on(table.kind),
}));

// Assets table (uploaded images, fonts, etc.)
export const assets = pgTable('assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('orgId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  r2Key: varchar('r2_key', { length: 500 }).notNull(),
  kind: varchar('kind', { length: 50, enum: ['image', 'font', 'other'] }).notNull(),
  width: integer('width'),
  height: integer('height'),
  dpi: integer('dpi'),
  size: integer('size'), // bytes
  mimeType: varchar('mime_type', { length: 100 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('assets_org_idx').on(table.orgId),
  r2KeyIdx: index('assets_r2_key_idx').on(table.r2Key),
}));

// Exports table
export const exports = pgTable('exports', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50, enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  r2Key: varchar('r2_key', { length: 500 }),
  spec: jsonb('spec').notNull(), // Export specifications (format, quality, etc.)
  errorMessage: text('error_message'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  completedAt: timestamp('completedAt'),
}, (table) => ({
  projectIdx: index('exports_project_idx').on(table.projectId),
  statusIdx: index('exports_status_idx').on(table.status),
}));

// Puzzle sets table
export const puzzleSets = pgTable('puzzle_sets', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50, enum: ['word_search', 'sudoku', 'maze', 'crossword'] }).notNull(),
  seed: varchar('seed', { length: 50 }).notNull(), // For deterministic generation
  params: jsonb('params').notNull(), // Difficulty, size, etc.
  content: jsonb('content').notNull(), // Generated puzzle + solution
  createdAt: timestamp('createdAt').defaultNow().notNull(),
}, (table) => ({
  projectIdx: index('puzzle_sets_project_idx').on(table.projectId),
}));

// AI generations table
export const aiGenerations = pgTable('ai_generations', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('orgId').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 50, enum: ['text', 'image', 'puzzle'] }).notNull(),
  prompt: text('prompt').notNull(),
  status: varchar('status', { length: 50, enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  cost: decimal('cost', { precision: 10, scale: 4 }),
  resultRef: varchar('result_ref', { length: 500 }), // Reference to asset or text content
  errorMessage: text('error_message'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  completedAt: timestamp('completedAt'),
}, (table) => ({
  orgIdx: index('ai_generations_org_idx').on(table.orgId),
  statusIdx: index('ai_generations_status_idx').on(table.status),
}));

// Listings table (KDP listing metadata)
export const listings = pgTable('listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  subtitle: varchar('subtitle', { length: 255 }),
  description: text('description').notNull(),
  keywords: jsonb('keywords').notNull(), // Array of keywords
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
}, (table) => ({
  projectIdx: index('listings_project_idx').on(table.projectId),
}));

// Relations for project tables
export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  docs: many(projectDocs),
  exports: many(exports),
  puzzleSets: many(puzzleSets),
  listing: one(listings),
}));

export const projectDocsRelations = relations(projectDocs, ({ one }) => ({
  project: one(projects, {
    fields: [projectDocs.projectId],
    references: [projects.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one }) => ({
  organization: one(organizations, {
    fields: [assets.orgId],
    references: [organizations.id],
  }),
}));

export const exportsRelations = relations(exports, ({ one }) => ({
  project: one(projects, {
    fields: [exports.projectId],
    references: [projects.id],
  }),
}));

export const puzzleSetsRelations = relations(puzzleSets, ({ one }) => ({
  project: one(projects, {
    fields: [puzzleSets.projectId],
    references: [projects.id],
  }),
}));

export const aiGenerationsRelations = relations(aiGenerations, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiGenerations.orgId],
    references: [organizations.id],
  }),
}));

export const listingsRelations = relations(listings, ({ one }) => ({
  project: one(projects, {
    fields: [listings.projectId],
    references: [projects.id],
  }),
}));

// Update schema export
export const schema = {
  users,
  accounts,
  sessions,
  verificationTokens,
  organizations,
  memberships,
  subscriptions,
  entitlementsUsage,
  keywordCache,
  nicheSnapshots,
  bsrCurves,
  savedNiches,
  projects,
  projectDocs,
  assets,
  exports,
  puzzleSets,
  aiGenerations,
  listings,
};
