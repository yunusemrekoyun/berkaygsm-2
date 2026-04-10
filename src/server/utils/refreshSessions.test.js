import { describe, expect, it } from "vitest";
import {
  buildRefreshSessionRecord,
  findRefreshSession,
  generateRefreshSessionId,
  hashRefreshToken,
  pruneRefreshSessions,
  removeRefreshSession,
  upsertRefreshSession,
} from "./refreshSessions.js";

function offsetDate(base, milliseconds) {
  return new Date(base.getTime() + milliseconds);
}

describe("refreshSessions", () => {
  it("creates deterministic token hashes", () => {
    expect(hashRefreshToken("abc")).toBe(hashRefreshToken("abc"));
    expect(hashRefreshToken("abc")).not.toBe(hashRefreshToken("xyz"));
  });

  it("generates a non-empty session id", () => {
    expect(generateRefreshSessionId()).toBeTruthy();
  });

  it("keeps only active sessions and prefers most recent ones", () => {
    const now = new Date();
    const sessions = pruneRefreshSessions(
      [
        buildRefreshSessionRecord({
          sid: "expired",
          token: "a",
          expiresAt: offsetDate(now, -60_000),
          createdAt: offsetDate(now, -7_200_000),
          lastUsedAt: offsetDate(now, -5_400_000),
        }),
        buildRefreshSessionRecord({
          sid: "older",
          token: "b",
          expiresAt: offsetDate(now, 86_400_000),
          createdAt: offsetDate(now, -14_400_000),
          lastUsedAt: offsetDate(now, -12_600_000),
        }),
        buildRefreshSessionRecord({
          sid: "newer",
          token: "c",
          expiresAt: offsetDate(now, 172_800_000),
          createdAt: offsetDate(now, -10_800_000),
          lastUsedAt: offsetDate(now, -3_600_000),
        }),
      ],
      { now, maxSessions: 1 }
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sid).toBe("newer");
  });

  it("matches sessions by sid and token hash", () => {
    const now = new Date();
    const record = buildRefreshSessionRecord({
      sid: "sid-1",
      token: "refresh-1",
      expiresAt: offsetDate(now, 86_400_000),
    });

    expect(
      findRefreshSession([record], {
        sid: "sid-1",
        token: "refresh-1",
        now,
      })?.sid
    ).toBe("sid-1");
    expect(
      findRefreshSession([record], {
        sid: "sid-1",
        token: "wrong-token",
        now,
      })
    ).toBeNull();
  });

  it("upserts sessions by sid", () => {
    const now = new Date();
    const first = buildRefreshSessionRecord({
      sid: "sid-1",
      token: "refresh-1",
      expiresAt: offsetDate(now, 86_400_000),
    });
    const updated = buildRefreshSessionRecord({
      sid: "sid-1",
      token: "refresh-2",
      expiresAt: offsetDate(now, 172_800_000),
    });

    const sessions = upsertRefreshSession([first], updated, { now });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(hashRefreshToken("refresh-2"));
  });

  it("removes only the targeted session", () => {
    const now = new Date();
    const first = buildRefreshSessionRecord({
      sid: "sid-1",
      token: "refresh-1",
      expiresAt: offsetDate(now, 86_400_000),
    });
    const second = buildRefreshSessionRecord({
      sid: "sid-2",
      token: "refresh-2",
      expiresAt: offsetDate(now, 172_800_000),
    });

    const sessions = removeRefreshSession([first, second], {
      sid: "sid-1",
      token: "refresh-1",
      now,
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sid).toBe("sid-2");
  });
});
