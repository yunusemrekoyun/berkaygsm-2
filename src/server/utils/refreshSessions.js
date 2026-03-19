import crypto from "crypto";

const DEFAULT_MAX_REFRESH_SESSIONS = Math.max(
  1,
  Number(process.env.MAX_REFRESH_SESSIONS || 5)
);

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hashRefreshToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

export function generateRefreshSessionId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

export function buildRefreshSessionRecord({
  sid,
  token,
  expiresAt = null,
  createdAt = new Date(),
  lastUsedAt = createdAt,
} = {}) {
  return {
    sid: String(sid || "").trim(),
    tokenHash: hashRefreshToken(token),
    expiresAt: asDate(expiresAt),
    createdAt: asDate(createdAt) || new Date(),
    lastUsedAt: asDate(lastUsedAt) || new Date(),
  };
}

export function pruneRefreshSessions(
  sessions = [],
  { now = new Date(), maxSessions = DEFAULT_MAX_REFRESH_SESSIONS } = {}
) {
  const nowTime = asDate(now)?.getTime() || Date.now();
  return (Array.isArray(sessions) ? sessions : [])
    .map((session) => ({
      sid: String(session?.sid || "").trim(),
      tokenHash: String(session?.tokenHash || "").trim(),
      expiresAt: asDate(session?.expiresAt),
      createdAt: asDate(session?.createdAt),
      lastUsedAt: asDate(session?.lastUsedAt),
    }))
    .filter((session) => session.sid && session.tokenHash)
    .filter((session) => {
      const expiresTime = session.expiresAt?.getTime?.() || null;
      return !expiresTime || expiresTime > nowTime;
    })
    .sort((left, right) => {
      const leftTime =
        left.lastUsedAt?.getTime?.() || left.createdAt?.getTime?.() || 0;
      const rightTime =
        right.lastUsedAt?.getTime?.() || right.createdAt?.getTime?.() || 0;
      return rightTime - leftTime;
    })
    .slice(0, Math.max(1, Number(maxSessions || DEFAULT_MAX_REFRESH_SESSIONS)));
}

export function findRefreshSession(
  sessions = [],
  { sid, token, now = new Date() } = {}
) {
  const normalizedSid = String(sid || "").trim();
  const tokenHash = hashRefreshToken(token);
  const candidates = pruneRefreshSessions(sessions, { now, maxSessions: Number.MAX_SAFE_INTEGER });
  return (
    candidates.find(
      (session) =>
        session.sid === normalizedSid && session.tokenHash === tokenHash
    ) || null
  );
}

export function upsertRefreshSession(
  sessions = [],
  sessionRecord,
  options = {}
) {
  const nextRecord = {
    ...sessionRecord,
    sid: String(sessionRecord?.sid || "").trim(),
    tokenHash: String(sessionRecord?.tokenHash || "").trim(),
    expiresAt: asDate(sessionRecord?.expiresAt),
    createdAt: asDate(sessionRecord?.createdAt) || new Date(),
    lastUsedAt: asDate(sessionRecord?.lastUsedAt) || new Date(),
  };
  const merged = [
    nextRecord,
    ...(Array.isArray(sessions) ? sessions : []).filter(
      (session) => String(session?.sid || "").trim() !== nextRecord.sid
    ),
  ];
  return pruneRefreshSessions(merged, options);
}

export function removeRefreshSession(sessions = [], { sid, token, now = new Date() } = {}) {
  const normalizedSid = String(sid || "").trim();
  const tokenHash = hashRefreshToken(token);
  return pruneRefreshSessions(sessions, { now, maxSessions: Number.MAX_SAFE_INTEGER }).filter(
    (session) =>
      !(
        session.sid === normalizedSid &&
        (!tokenHash || session.tokenHash === tokenHash)
      )
  );
}
