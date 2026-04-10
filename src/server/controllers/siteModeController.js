import User from "../models/User.js";
import {
  dispatchMaintenanceAnnouncement,
  getSiteModeConfig,
  shapeSiteModeConfig,
} from "../services/siteModeService.js";
import {
  assertMaintenanceAnnouncementSecretConfigured,
  verifyMaintenanceAnnouncementUnsubscribeToken,
} from "../utils/maintenanceAnnouncementTokens.js";

function parseBooleanLike(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function htmlPage({ title, body }) {
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef7ff;color:#0f172a}
      .wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
      .card{max-width:560px;width:100%;background:#fff;border:1px solid #bae6fd;border-radius:24px;padding:28px;box-shadow:0 20px 50px rgba(12,74,110,.12)}
      h1{margin:0 0 12px;font-size:28px;color:#0c4a6e}
      p{margin:0 0 12px;line-height:1.7;color:#334155}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${title}</h1>
        ${body}
      </div>
    </div>
  </body>
</html>`;
}

export async function getSiteModeManage(req, res) {
  try {
    const config = await getSiteModeConfig();
    res.json({ siteMode: shapeSiteModeConfig(config) });
  } catch (error) {
    res
      .status(500)
      .json({ message: error?.message || "Site modu yüklenemedi" });
  }
}

export async function updateSiteModeManage(req, res) {
  try {
    const enabled = parseBooleanLike(req.body?.maintenanceModeEnabled, false);
    const config = await getSiteModeConfig();
    const previous = !!config.maintenanceModeEnabled;
    const changed = previous !== enabled;

    if (changed) {
      assertMaintenanceAnnouncementSecretConfigured();
    }

    config.maintenanceModeEnabled = enabled;
    config.maintenanceModeUpdatedAt = new Date();
    config.maintenanceModeUpdatedBy = req.userId || null;

    if (changed) {
      config.announcementDispatching = true;
      config.lastAnnouncementQueuedAt = new Date();
      config.lastAnnouncementError = "";
      config.lastAnnouncementState = enabled ? "enabled" : "disabled";
    }

    await config.save();

    const dispatch =
      changed && config.announcementDispatching
        ? await dispatchMaintenanceAnnouncement({ enabled })
        : null;
    const latestConfig = dispatch ? await getSiteModeConfig() : config;

    res.json({
      siteMode: shapeSiteModeConfig(latestConfig),
      changed,
      dispatch,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error?.message || "Site modu güncellenemedi" });
  }
}

export async function unsubscribeMaintenanceAnnouncements(req, res) {
  const token = String(req.query?.token || req.body?.token || "").trim();
  if (!token) {
    res.status(status).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(
      htmlPage({
        title: "Geçersiz bağlantı",
        body: "<p>Abonelikten çıkış bağlantısı eksik veya geçersiz.</p>",
      })
    );
  }

  try {
    const payload = verifyMaintenanceAnnouncementUnsubscribeToken(token);
    const user = await User.findOne({
      _id: payload.userId,
      email: payload.email,
    });

    if (!user) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(
        htmlPage({
          title: "Kayıt bulunamadı",
          body: "<p>Bu abonelik bağlantısına ait kullanıcı kaydı bulunamadı.</p>",
        })
      );
    }

    user.maintenanceAnnouncementsEnabled = false;
    await user.save();

    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(
      htmlPage({
        title: "Abonelikten çıkıldı",
        body:
          "<p>Bakım ve site durumu duyuruları için e-posta aboneliğiniz kapatıldı.</p><p>Dilerseniz hesabınıza giriş yaptıktan sonra profil ekranından tekrar açabilirsiniz.</p>",
      })
    );
  } catch (error) {
    const status =
      error?.message === "MAINTENANCE_ANNOUNCEMENT_SECRET yapılandırılmamış"
        ? 500
        : 400;
    res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(
      htmlPage({
        title: status === 500 ? "Yapılandırma hatası" : "Bağlantı geçersiz",
        body:
          status === 500
            ? "<p>Bakım duyurusu abonelik sistemi şu anda yapılandırılmamış. Lütfen daha sonra tekrar deneyin.</p>"
            : "<p>Abonelikten çıkış bağlantısı doğrulanamadı. Lütfen daha sonra tekrar deneyin.</p>",
      })
    );
  }
}
