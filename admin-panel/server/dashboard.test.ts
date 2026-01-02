import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

function createAuthContext(role: "admin" | "viewer" = "admin"): TrpcContext {
  const user: User = {
    id: 1,
    username: "testuser",
    passwordHash: "$2a$10$test",
    name: "Test User",
    email: "test@example.com",
    role,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("dashboard.getStatus", () => {
  it("returns dashboard status for admin user", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStatus();

    // Verify connector status
    expect(result.connector).toBeDefined();
    expect(result.connector.status).toBe("running");
    expect(result.connector.uptime).toBeDefined();

    // Verify OneBox status
    expect(result.onebox).toBeDefined();
    expect(result.onebox.status).toBe("connected");
    expect(result.onebox.lastSync).toBeDefined();

    // Verify scales status
    expect(result.scales).toBeDefined();
    expect(typeof result.scales.total).toBe("number");
    expect(typeof result.scales.online).toBe("number");
    expect(typeof result.scales.offline).toBe("number");
    expect(result.scales.total).toBe(result.scales.online + result.scales.offline);

    // Verify printers status
    expect(result.printers).toBeDefined();
    expect(typeof result.printers.total).toBe("number");
    expect(typeof result.printers.online).toBe("number");
    expect(typeof result.printers.offline).toBe("number");
    expect(result.printers.total).toBe(result.printers.online + result.printers.offline);

    // Verify queue status
    expect(result.queue).toBeDefined();
    expect(typeof result.queue.active).toBe("number");
    expect(typeof result.queue.stuck).toBe("number");

    // Verify errors array
    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.length).toBeLessThanOrEqual(10);

    // Verify error structure
    const firstError = result.errors[0];
    expect(firstError.id).toBeDefined();
    expect(firstError.timestamp).toBeDefined();
    expect(firstError.severity).toBeDefined();
    expect(["error", "warning", "info"]).toContain(firstError.severity);
    expect(firstError.messageKey).toBeDefined();
    expect(firstError.messageParams).toBeDefined();
    expect(firstError.source).toBeDefined();
  });

  it("returns dashboard status for viewer user", async () => {
    const ctx = createAuthContext("viewer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getStatus();

    // Viewer should have same access to dashboard data
    expect(result.connector).toBeDefined();
    expect(result.onebox).toBeDefined();
    expect(result.scales).toBeDefined();
    expect(result.printers).toBeDefined();
    expect(result.queue).toBeDefined();
    expect(result.errors).toBeDefined();
  });

  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.dashboard.getStatus()).rejects.toThrow();
  });
});
