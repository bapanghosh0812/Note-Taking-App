import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { Preferences } from "../../lib/preferences";

/** Raw binary column (Postgres bytea) — used for the small profile photo. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const shareTypeEnum = pgEnum("share_type", ["one_time", "time_based"]);
export const accessTypeEnum = pgEnum("access_type", ["public", "password"]);

/** Stored partially; always read through resolvePreferences() which fills defaults. */
export type UserPreferences = Partial<Preferences>;

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    preferences: jsonb("preferences").$type<UserPreferences>().notNull().default({}),
    bio: varchar("bio", { length: 160 }),
    avatarColor: varchar("avatar_color", { length: 16 }),
    // Profile photo: re-sized in the browser (≤256×256), type-checked by magic bytes on upload.
    avatarImage: bytea("avatar_image"),
    avatarMime: varchar("avatar_mime", { length: 16 }),
    avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    // Two-factor auth: the TOTP secret is AES-256-GCM encrypted (it must be readable to verify codes).
    totpSecret: text("totp_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    // SHA-256 hashes of unused one-time backup codes.
    backupCodes: jsonb("backup_codes").$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

/**
 * Server-side sessions. The cookie holds a random token; only its SHA-256
 * digest is stored here, so a database leak cannot be replayed as a login.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // sha256(token) hex
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: varchar("user_agent", { length: 256 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    color: varchar("color", { length: 16 }),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // in trash
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("notes_owner_updated_idx").on(t.ownerId, t.updatedAt.desc()),
    check("notes_content_length", sql`char_length(${t.content}) <= 50000`),
    check("notes_tags_count", sql`cardinality(${t.tags}) <= 10`),
  ],
);

/** Snapshots of earlier note versions (restorable from the history panel). */
export const noteVersions = pgTable(
  "note_versions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("note_versions_note_created_idx").on(t.noteId, t.createdAt.desc())],
);

/**
 * A note can have many share links, each with its own access rules.
 * The raw token and access key are never stored — only their hashes.
 */
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(), // sha256(token) hex
    tokenPrefix: varchar("token_prefix", { length: 8 }).notNull(), // for display only
    label: varchar("label", { length: 60 }),
    shareType: shareTypeEnum("share_type").notNull(),
    accessType: accessTypeEnum("access_type").notNull(),
    keyHash: text("key_hash"), // scrypt hash, only for password links
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }), // one-time links
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("share_links_token_hash_key").on(t.tokenHash),
    index("share_links_note_id_idx").on(t.noteId),
    check("share_links_view_count_non_negative", sql`${t.viewCount} >= 0`),
    // Defense in depth: even a buggy code path cannot record a second view of a one-time link.
    check(
      "share_links_one_time_single_view",
      sql`${t.shareType} <> 'one_time' OR ${t.viewCount} <= 1`,
    ),
    // A password link must have a key hash; a public link must not.
    check(
      "share_links_key_matches_access",
      sql`(${t.accessType} = 'password') = (${t.keyHash} IS NOT NULL)`,
    ),
  ],
);

/** Append-only audit trail of successful views (used for the activity feed). */
export const shareViews = pgTable(
  "share_views",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => shareLinks.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
    method: accessTypeEnum("method").notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 256 }),
    country: varchar("country", { length: 2 }),
  },
  (t) => [index("share_views_link_viewed_idx").on(t.linkId, t.viewedAt.desc())],
);

/** In-app notifications (bell icon). */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: varchar("body", { length: 400 }),
    href: varchar("href", { length: 300 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt.desc())],
);

/** Account security log: sign-ins, failed attempts, password and 2FA changes. */
export const securityEvents = pgTable(
  "security_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 256 }),
    createdAt: createdAt(),
  },
  (t) => [index("security_events_user_created_idx").on(t.userId, t.createdAt.desc())],
);

/** Feedback sent from the Help page. */
export const feedback = pgTable("feedback", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  kind: varchar("kind", { length: 16 }).notNull(),
  message: text("message").notNull(),
  page: varchar("page", { length: 200 }),
  createdAt: createdAt(),
});

/** Fixed-window rate limit counters, shared by every server instance. */
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 200 }).primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export type User = typeof users.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
