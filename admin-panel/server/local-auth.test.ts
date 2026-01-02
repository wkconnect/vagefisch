import { describe, expect, it, vi, beforeEach } from "vitest";
import { hashPassword, verifyPassword, createSessionToken, verifySession } from "./_core/auth";

describe("Local Authentication", () => {
  describe("Password Hashing", () => {
    it("should hash password with bcrypt", async () => {
      const password = "testPassword123";
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2")).toBe(true); // bcrypt hash prefix
    });

    it("should verify correct password", async () => {
      const password = "testPassword123";
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect password", async () => {
      const password = "testPassword123";
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword("wrongPassword", hash);
      expect(isValid).toBe(false);
    });
  });

  describe("JWT Session Tokens", () => {
    const mockUser = {
      id: 1,
      username: "admin",
      name: "Administrator",
      role: "admin" as const,
    };

    it("should create valid JWT token", async () => {
      const token = await createSessionToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT has 3 parts
    });

    it("should verify and decode valid token", async () => {
      const token = await createSessionToken(mockUser);
      const decoded = await verifySession(token);
      
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(mockUser.id);
      expect(decoded?.username).toBe(mockUser.username);
      expect(decoded?.role).toBe(mockUser.role);
    });

    it("should reject invalid token", async () => {
      const decoded = await verifySession("invalid.token.here");
      expect(decoded).toBeNull();
    });

    it("should reject tampered token", async () => {
      const token = await createSessionToken(mockUser);
      const tamperedToken = token.slice(0, -5) + "xxxxx";
      
      const decoded = await verifySession(tamperedToken);
      expect(decoded).toBeNull();
    });
  });
});
