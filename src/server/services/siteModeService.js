import SiteModeConfig from "../models/SiteModeConfig.js";
import User from "../models/User.js";
import {
  sendMaintenanceAnnouncementEmail,
} from "./emailService.js";
import { connectDB } from "../config/db.js";
import { logger } from "../utils/logger.js";

let announcementDispatchPromise = null;

export function shapeSiteModeConfig(config) {
  if (!config) return null;
  return {
    id: config._id?.toString?.() || String(config._id || ""),
    maintenanceModeEnabled: !!config.maintenanceModeEnabled,
    maintenanceModeUpdatedAt: config.maintenanceModeUpdatedAt || null,
    maintenanceModeUpdatedBy:
      config.maintenanceModeUpdatedBy?._id?.toString?.() ||
      config.maintenanceModeUpdatedBy?.toString?.() ||
      null,
    lastAnnouncementState: config.lastAnnouncementState || "",
    lastAnnouncementQueuedAt: config.lastAnnouncementQueuedAt || null,
    lastAnnouncementCompletedAt: config.lastAnnouncementCompletedAt || null,
    lastAnnouncementRecipientCount: Number(config.lastAnnouncementRecipientCount || 0),
    lastAnnouncementDeliveredCount: Number(
      config.lastAnnouncementDeliveredCount || 0
    ),
    lastAnnouncementFailedCount: Number(config.lastAnnouncementFailedCount || 0),
    lastAnnouncementError: config.lastAnnouncementError || "",
    announcementDispatching: !!config.announcementDispatching,
  };
}

export async function getSiteModeConfig() {
  await connectDB();
  return SiteModeConfig.getSingleton();
}

export async function getSiteModeSnapshot() {
  const config = await getSiteModeConfig();
  return shapeSiteModeConfig(config);
}

async function sendMaintenanceAnnouncementBatch({ enabled }) {
  const config = await getSiteModeConfig();
  const state = enabled ? "enabled" : "disabled";
  const users = await User.find({
    isDeleted: false,
    role: "user",
    email: { $exists: true, $ne: "" },
    maintenanceAnnouncementsEnabled: { $ne: false },
  })
    .select("_id firstName lastName email maintenanceAnnouncementsEnabled")
    .lean();

  let delivered = 0;
  let failed = 0;
  let lastError = "";

  const chunkSize = 20;
  for (let start = 0; start < users.length; start += chunkSize) {
    const chunk = users.slice(start, start + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((user) =>
        sendMaintenanceAnnouncementEmail({
          user,
          enabled,
        })
      )
    );
    for (const result of results) {
      const value =
        result.status === "fulfilled"
          ? result.value
          : { ok: false, error: result.reason?.message || "mail-send-failed" };
      if (value?.ok) {
        delivered += 1;
      } else if (!value?.skipped) {
        failed += 1;
        lastError = value?.error || lastError || "mail-send-failed";
      }
    }
  }

  config.lastAnnouncementState = state;
  config.lastAnnouncementCompletedAt = new Date();
  config.lastAnnouncementRecipientCount = users.length;
  config.lastAnnouncementDeliveredCount = delivered;
  config.lastAnnouncementFailedCount = failed;
  config.lastAnnouncementError = lastError;
  config.announcementDispatching = false;
  await config.save();
}

export function queueMaintenanceAnnouncementDispatch({ enabled }) {
  if (announcementDispatchPromise) {
    announcementDispatchPromise = announcementDispatchPromise.finally(() =>
      sendMaintenanceAnnouncementBatch({ enabled }).catch((error) => {
        logger.error(
          { err: error?.message || String(error), enabled },
          "Maintenance announcement dispatch failed"
        );
      })
    );
    return announcementDispatchPromise;
  }

  announcementDispatchPromise = sendMaintenanceAnnouncementBatch({ enabled })
    .catch(async (error) => {
      logger.error(
        { err: error?.message || String(error), enabled },
        "Maintenance announcement dispatch failed"
      );
      const config = await getSiteModeConfig().catch(() => null);
      if (config) {
        config.lastAnnouncementCompletedAt = new Date();
        config.lastAnnouncementError = error?.message || String(error);
        config.announcementDispatching = false;
        await config.save().catch(() => {});
      }
    })
    .finally(() => {
      announcementDispatchPromise = null;
    });

  return announcementDispatchPromise;
}
