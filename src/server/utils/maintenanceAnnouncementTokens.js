import jwt from "jsonwebtoken";

function getSecret() {
  const secret = String(process.env.MAINTENANCE_ANNOUNCEMENT_SECRET || "").trim();
  if (!secret) {
    throw new Error("MAINTENANCE_ANNOUNCEMENT_SECRET yapılandırılmamış");
  }
  return secret;
}

export function assertMaintenanceAnnouncementSecretConfigured() {
  return getSecret();
}

export function signMaintenanceAnnouncementUnsubscribeToken({
  userId,
  email,
}) {
  return jwt.sign(
    {
      sub: String(userId || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      purpose: "maintenance-announcements-unsubscribe",
    },
    getSecret()
  );
}

export function verifyMaintenanceAnnouncementUnsubscribeToken(token) {
  const payload = jwt.verify(String(token || "").trim(), getSecret());
  if (payload?.purpose !== "maintenance-announcements-unsubscribe") {
    throw new Error("Geçersiz maintenance announcement token");
  }
  return {
    userId: String(payload?.sub || "").trim(),
    email: String(payload?.email || "").trim().toLowerCase(),
  };
}
