import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
} from "drizzle-orm/pg-core";

// Session storage table for user authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DSA Confidence data table
export const dsaConfidence = pgTable("dsa_confidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  problemId: varchar("problem_id").notNull(), // identifier for the DSA problem
  confidenceLevel: varchar("confidence_level").notNull(), // none, low, medium, high, expert
  sheetName: varchar("sheet_name"), // which DSA sheet (A2Z, SDE, etc.)
  problemTitle: text("problem_title"), // title of the problem for reference
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_problem").on(table.userId, table.problemId),
  index("idx_user_sheet").on(table.userId, table.sheetName),
]);

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;
export type DsaConfidence = typeof dsaConfidence.$inferSelect;
export type InsertDsaConfidence = typeof dsaConfidence.$inferInsert;
export type UpdateDsaConfidence = typeof dsaConfidence.$inferUpdate;