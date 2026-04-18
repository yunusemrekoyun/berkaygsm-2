import PaynetSession from "../models/PaynetSession.js";
import {
  releaseReservedStock,
  runInMongoTransaction,
} from "../controllers/orderController.js";
import { logger } from "../utils/logger.js";

const CLEANUP_INTERVAL_MS = Math.max(
  30_000,
  Number(process.env.PAYNET_MAINTENANCE_INTERVAL_MS || 60_000) || 60_000
);
const CLEANUP_BATCH_SIZE = Math.max(
  1,
  Number(process.env.PAYNET_MAINTENANCE_BATCH_SIZE || 25) || 25
);

let maintenancePromise = null;
let lastStartedAt = 0;

function getReservationEntries(sessionDoc) {
  const entries = sessionDoc?.stockReservation?.entries;
  return Array.isArray(entries) ? entries : [];
}

function hasActiveReservation(sessionDoc) {
  return (
    String(sessionDoc?.stockReservation?.state || "none") === "reserved" &&
    getReservationEntries(sessionDoc).length > 0
  );
}

function buildReleasedReservation(sessionDoc, releasedAt) {
  const entries = getReservationEntries(sessionDoc);
  return {
    state: entries.length ? "released" : "none",
    entries,
    reservedAt: sessionDoc?.stockReservation?.reservedAt || null,
    releasedAt: entries.length ? releasedAt : null,
    committedAt: null,
  };
}

function isExpiredPendingSession(sessionDoc, now = new Date()) {
  if (String(sessionDoc?.status || "") !== "pending") return false;
  const expiresAt = sessionDoc?.expiresAt ? new Date(sessionDoc.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() <= now.getTime();
}

async function expireSingleSession(sessionId, now) {
  await runInMongoTransaction(async (mongoSession) => {
    const query = PaynetSession.findById(sessionId);
    if (mongoSession) query.session(mongoSession);
    const currentSession = await query;
    if (!currentSession || !isExpiredPendingSession(currentSession, now)) return;

    if (hasActiveReservation(currentSession)) {
      await releaseReservedStock(getReservationEntries(currentSession), {
        session: mongoSession || null,
      });
    }

    currentSession.status = "expired";
    currentSession.fingerprintKey = null;
    currentSession.stockReservation = buildReleasedReservation(currentSession, now);
    currentSession.lastError = {
      phase: "initialize",
      code: "SESSION_EXPIRED",
      message: "Paynet ödeme oturumu süresi doldu.",
    };
    await currentSession.save(mongoSession ? { session: mongoSession } : undefined);
  });
}

async function runCleanupTick() {
  const now = new Date();
  const expiredSessions = await PaynetSession.find({
    status: "pending",
    expiresAt: { $lte: now },
  })
    .select("_id")
    .sort({ expiresAt: 1, createdAt: 1 })
    .limit(CLEANUP_BATCH_SIZE)
    .lean();

  for (const sessionDoc of expiredSessions) {
    try {
      await expireSingleSession(sessionDoc._id, now);
    } catch (error) {
      logger.error(
        {
          err: error?.message || String(error),
          sessionId: sessionDoc?._id?.toString?.() || String(sessionDoc?._id || ""),
        },
        "Failed to expire Paynet session"
      );
    }
  }
}

export function kickPaynetSessionMaintenance() {
  const now = Date.now();
  if (maintenancePromise) return maintenancePromise;
  if (now - lastStartedAt < CLEANUP_INTERVAL_MS) return Promise.resolve(false);

  lastStartedAt = now;
  maintenancePromise = runCleanupTick()
    .then(() => true)
    .catch((error) => {
      logger.error(
        { err: error?.message || String(error) },
        "Paynet session maintenance tick failed"
      );
      return false;
    })
    .finally(() => {
      maintenancePromise = null;
    });

  return maintenancePromise;
}
