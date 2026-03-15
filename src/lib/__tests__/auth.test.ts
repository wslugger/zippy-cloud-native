import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;
const VALID_SECRET = "12345678901234567890123456789012";

describe("auth configuration", () => {
  afterEach(() => {
    vi.resetModules();
    if (ORIGINAL_JWT_SECRET === undefined) {
      delete process.env.JWT_SECRET;
      return;
    }
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  });

  it("throws when JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    const { encrypt } = await import("@/lib/auth");
    await expect(encrypt({ userId: "u1", email: "a@b.com", role: "SA" })).rejects.toThrow(
      "JWT_SECRET environment variable is required",
    );
  });

  it("throws when JWT_SECRET is shorter than 32 characters", async () => {
    process.env.JWT_SECRET = "short-secret";
    const { encrypt } = await import("@/lib/auth");
    await expect(encrypt({ userId: "u1", email: "a@b.com", role: "SA" })).rejects.toThrow(
      "JWT_SECRET must be at least 32 characters",
    );
  });
});

describe("session refresh threshold", () => {
  afterEach(() => {
    vi.resetModules();
    if (ORIGINAL_JWT_SECRET === undefined) {
      delete process.env.JWT_SECRET;
      return;
    }
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  });

  it("requests refresh when exp is missing", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    const { shouldRefreshSession } = await import("@/lib/auth");
    expect(shouldRefreshSession({ userId: "u1", email: "a@b.com", role: "SA" }, 0)).toBe(true);
  });

  it("refreshes when <= 60 minutes remain", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    const { shouldRefreshSession } = await import("@/lib/auth");
    const nowMs = 1_000_000;
    const expSeconds = Math.floor((nowMs + 59 * 60 * 1000) / 1000);

    expect(
      shouldRefreshSession(
        { userId: "u1", email: "a@b.com", role: "SA", exp: expSeconds },
        nowMs,
      ),
    ).toBe(true);
  });

  it("does not refresh when > 60 minutes remain", async () => {
    process.env.JWT_SECRET = VALID_SECRET;
    const { shouldRefreshSession } = await import("@/lib/auth");
    const nowMs = 1_000_000;
    const expSeconds = Math.floor((nowMs + 61 * 60 * 1000) / 1000);

    expect(
      shouldRefreshSession(
        { userId: "u1", email: "a@b.com", role: "SA", exp: expSeconds },
        nowMs,
      ),
    ).toBe(false);
  });
});
