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

describe("refreshSessions", () => {
  it("creates deterministic token hashes", () => {
    expect(hashRefreshToken("abc")).toBe(hashRefreshToken("abc"));
    expect(hashRefreshToken("abc")).not.toBe(hashRefreshToken("xyz"));
  });

  it("generates a non-empty session id", () => {
    expect(generateRefreshSessionId()).toBeTruthy();
  });

  it("keeps only active sessions and prefers most recent ones", () => {
    const now = new Date("2026-03-19T12:00:00.000Z");
    const sessions = pruneRefreshSessions(
      [
        buildRefreshSessionRecord({
          sid: "expired",
          token: "a",
          expiresAt: "2026-03-18T12:00:00.000Z",
          createdAt: "2026-03-18T11:00:00.000Z",
          lastUsedAt: "2026-03-18T11:30:00.000Z",
        }),
        buildRefreshSessionRecord({
          sid: "older",
          token: "b",
          expiresAt: "2026-03-20T12:00:00.000Z",
          createdAt: "2026-03-19T08:00:00.000Z",
          lastUsedAt: "2026-03-19T08:30:00.000Z",
        }),
        buildRefreshSessionRecord({
          sid: "newer",
          token: "c",
          expiresAt: "2026-03-21T12:00:00.000Z",
          createdAt: "2026-03-19T09:00:00.000Z",
          lastUsedAt: "2026-03-19T11:00:00.000Z",
        }),
      ],
      { now, maxSessions: 1 }
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sid).toBe("newer");
  });

  it("matches sessions by sid and token hash", () => {
    const record = buildRefreshSessionRecord({
      sid: "sid-1",
      token: "refresh-1",
      expiresAt: "2026-03-20T12:00:00.000Z",
    });

    expect(
      findRefreshSession([record], {
        sid: "sid-1",
        token: "refresh-1",
      })?.sid
    ).toBe("sid-1");
    expect(
      findRefreshSession([record], {
        sid: "sid-1",
        token: "wrong-token",
      })
    ).toBeNull();
  });

  it("upserts sessions by sid", () => {
    const first = buildRefreshSessionRecord({
      sid: "sid-1",
      token: "refresh-1",
      expiresAt: "2026-03-20T12:00:00.000Z",
    });
    const updated = buildRefreshSessionRecord({
      sid: "sid-1",
      token: "refresh-2",
      expiresAt: "2026-03-21T12:00:00.000Z",
    });

    const sessions = upsertRefreshSession([first], updated);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(hashRefreshToken("refresh-2"));
  });

  it("removes only the targeted session", () => {
    const first = buildRefreshSessionRecord({
      sid: "sid-1",
      token: "refresh-1",
      expiresAt: "2026-03-20T12:00:00.000Z",
    });
    const second = buildRefreshSessionRecord({
      sid: "sid-2",
      token: "refresh-2",
      expiresAt: "2026-03-21T12:00:00.000Z",
    });

    const sessions = removeRefreshSession([first, second], {
      sid: "sid-1",
      token: "refresh-1",
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0].sid).toBe("sid-2");
  });
});
