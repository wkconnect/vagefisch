import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { LocalUser as User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";
import bcrypt from "bcryptjs";

export type SessionPayload = {
  userId: number;
  username: string;
  role: string;
};

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Parse cookies from request header
 */
function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  if (!cookieHeader) {
    return new Map<string, string>();
  }
  const parsed = parseCookieHeader(cookieHeader);
  return new Map(Object.entries(parsed));
}

/**
 * Get session secret for JWT signing
 */
function getSessionSecret(): Uint8Array {
  const secret = ENV.cookieSecret;
  return new TextEncoder().encode(secret);
}

/**
 * Create a session token for a user
 */
export async function createSessionToken(
  user: User,
  options: { expiresInMs?: number } = {}
): Promise<string> {
  const issuedAt = Date.now();
  const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
  const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
  const secretKey = getSessionSecret();
  return new SignJWT({
    userId: user.id,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

/**
 * Verify a session token and return payload
 */
export async function verifySession(
  cookieValue: string | undefined | null
): Promise<SessionPayload | null> {
  if (!cookieValue) {
    console.warn("[Auth] Missing session cookie");
    return null;
  }
  try {
    const secretKey = getSessionSecret();
    const { payload } = await jwtVerify(cookieValue, secretKey, {
      algorithms: ["HS256"],
    });
    const { userId, username, role } = payload as Record<string, unknown>;
    if (
      typeof userId !== "number" ||
      typeof username !== "string" ||
      typeof role !== "string"
    ) {
      console.warn("[Auth] Session payload missing required fields");
      return null;
    }
    return { userId, username, role };
  } catch (error) {
    console.warn("[Auth] Session verification failed", String(error));
    return null;
  }
}

/**
 * Authenticate a user with username and password
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<User | null> {
  const user = await db.getUserByUsername(username);
  if (!user) {
    console.log("[Auth] User not found:", username);
    return null;
  }
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    console.log("[Auth] Invalid password for user:", username);
    return null;
  }
  // Update last login
  await db.updateLastLogin(user.id);
  return user;
}

/**
 * Authenticate request from session cookie
 */
export async function authenticateRequest(req: Request): Promise<User> {
  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies.get(COOKIE_NAME);
  const session = await verifySession(sessionCookie);
  if (!session) {
    throw ForbiddenError("Invalid session cookie");
  }
  const user = await db.getUserById(session.userId);
  if (!user) {
    throw ForbiddenError("User not found");
  }
  return user;
}

/**
 * Set session cookie on response
 */
export async function setSessionCookie(res: Response, user: User, req?: Request): Promise<void> {
  const token = await createSessionToken(user);
  // Use simple cookie options for HTTP (no HTTPS)
  const cookieOptions = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ONE_YEAR_MS,
  };
  
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

/**
 * Clear session cookie on response
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    path: "/",
  });
}

/**
 * Create default admin user if no users exist
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const hasUsers = await db.hasAnyUsers();
  if (hasUsers) {
    return;
  }
  // Check for env-based admin credentials
  const adminUsername = ENV.adminUsername || "admin";
  const adminPassword = ENV.adminPassword || "admin123";
  console.log("[Auth] Creating default admin user...");
  const passwordHash = await hashPassword(adminPassword);
  
  try {
    await db.createUser({
      username: adminUsername,
      passwordHash,
      name: "Administrator",
      role: "admin",
    });
    console.log(`[Auth] Default admin created: username=${adminUsername}`);
    if (!ENV.adminPassword) {
      console.log("[Auth] ⚠️  CHANGE THE DEFAULT PASSWORD IMMEDIATELY!");
    }
  } catch (error) {
    console.error("[Auth] Failed to create default admin:", error);
  }
}
