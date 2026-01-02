import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Local users table for standalone authentication.
 * Supports login/password authentication without external OAuth.
 */
export const users = mysqlTable("local_users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   */
  id: int("id").autoincrement().primaryKey(),
  
  /** Unique username for login */
  username: varchar("username", { length: 64 }).notNull().unique(),
  
  /** bcrypt hashed password */
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  
  /** Display name */
  name: text("name"),
  
  /** Email address (optional) */
  email: varchar("email", { length: 320 }),
  
  /** User role: admin (full access), operator (standard), viewer (read-only) */
  role: mysqlEnum("role", ["admin", "operator", "viewer"]).default("viewer").notNull(),
  
  /** Whether the user account is active */
  isActive: boolean("is_active").default(true).notNull(),
  
  /** Account creation timestamp */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  
  /** Last update timestamp */
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  
  /** Last login timestamp */
  lastLoginAt: timestamp("last_login_at"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
