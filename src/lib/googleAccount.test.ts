import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { linkGoogleAccount } from "./googleAccount";

const verified = { email: "pat@example.com", email_verified: true, name: "Pat Lee", picture: "https://img/pat.png" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("linkGoogleAccount: who is allowed in", () => {
  it("refuses an address Google has not verified, without touching the database", async () => {
    const result = await linkGoogleAccount({ ...verified, email_verified: false });
    expect(result).toEqual({ ok: false, reason: "unverified_email" });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("refuses when the verification flag is missing entirely", async () => {
    const result = await linkGoogleAccount({ email: "pat@example.com", name: "Pat" });
    expect(result.ok).toBe(false);
  });

  it("refuses when there is no email at all", async () => {
    expect((await linkGoogleAccount({ email_verified: true })).ok).toBe(false);
  });
});

describe("linkGoogleAccount: a new person", () => {
  it("creates an account with a lowercased email, no password, and a verified date", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: "u1" });

    const result = await linkGoogleAccount({ ...verified, email: "  Pat@Example.COM " });

    expect(result).toEqual({ ok: true, userId: "u1", passwordRevoked: false });
    const data = db.user.create.mock.calls[0][0].data;
    expect(data.email).toBe("pat@example.com");
    expect(data.name).toBe("Pat Lee");
    expect(data.passwordHash).toBeUndefined();
    expect(data.emailVerified).toBeInstanceOf(Date);
  });

  it("falls back to the account that won a race between two first sign-ins", async () => {
    db.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "winner", email: "pat@example.com", name: "Pat", image: null, passwordHash: null, emailVerified: new Date(),
    });
    db.user.create.mockRejectedValue(new Error("Unique constraint failed"));

    const result = await linkGoogleAccount(verified);
    expect(result).toEqual({ ok: true, userId: "winner", passwordRevoked: false });
  });

  it("does not swallow a real database failure", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockRejectedValue(new Error("database is down"));
    await expect(linkGoogleAccount(verified)).rejects.toThrow("database is down");
  });
});

describe("linkGoogleAccount: someone who already has an account", () => {
  it("clears the password the first time Google verifies an address that had one", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "u2", email: "pat@example.com", name: null, image: null, passwordHash: "$2a$hash", emailVerified: null,
    });

    const result = await linkGoogleAccount(verified);

    expect(result).toEqual({ ok: true, userId: "u2", passwordRevoked: true });
    const data = db.user.update.mock.calls[0][0].data;
    expect(data.passwordHash).toBeNull();
    expect(data.emailVerified).toBeInstanceOf(Date);
  });

  it("leaves a Google-only account alone on later sign-ins", async () => {
    const verifiedAt = new Date("2026-01-01");
    db.user.findUnique.mockResolvedValue({
      id: "u3", email: "pat@example.com", name: "Pat", image: "x", passwordHash: null, emailVerified: verifiedAt,
    });

    const result = await linkGoogleAccount(verified);

    expect(result).toEqual({ ok: true, userId: "u3", passwordRevoked: false });
    const data = db.user.update.mock.calls[0][0].data;
    expect("passwordHash" in data).toBe(false);
    expect(data.emailVerified).toBe(verifiedAt);
  });

  it("never overwrites a name or photo the person already has", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "u4", email: "pat@example.com", name: "Patricia", image: "mine.png", passwordHash: null, emailVerified: new Date(),
    });

    await linkGoogleAccount(verified);

    const data = db.user.update.mock.calls[0][0].data;
    expect(data.name).toBe("Patricia");
    expect(data.image).toBe("mine.png");
  });

  it("fills in a missing name or photo from Google", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "u5", email: "pat@example.com", name: null, image: null, passwordHash: null, emailVerified: new Date(),
    });

    await linkGoogleAccount(verified);

    const data = db.user.update.mock.calls[0][0].data;
    expect(data.name).toBe("Pat Lee");
    expect(data.image).toBe("https://img/pat.png");
  });
});
