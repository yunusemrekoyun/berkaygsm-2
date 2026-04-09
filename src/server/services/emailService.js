import nodemailer from "nodemailer";
import {
  OFFICIAL_ADDRESS,
  OFFICIAL_PHONE,
  OFFICIAL_SUPPORT_EMAIL,
} from "../../config/siteContact.js";
import { logger } from "../utils/logger.js";

let cachedTransporter = null;

const BRAND_COLOR = "#0c4a6e";
const BRAND_ACCENT = "#38bdf8";
const BRAND_SURFACE = "#f5fbff";
const BRAND_BORDER = "#bae6fd";
const LOGO_PATH = "/ceplife-logo-cropped.png";

function env(name, fallback = "") {
  return String(process.env[name] || fallback || "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

function getMailConfig() {
  const fromAddress = env("MAIL_FROM_ADDRESS", OFFICIAL_SUPPORT_EMAIL);
  const adminInbox = env("MAIL_ADMIN_INBOX", OFFICIAL_SUPPORT_EMAIL);
  const fromName = env("MAIL_FROM_NAME", "CepLife");
  const appPassword = env("MAIL_APP_PASSWORD");

  return {
    fromAddress,
    adminInbox,
    fromName,
    appPassword,
  };
}

function getPublicSiteUrl() {
  const explicit =
    env("MAIL_PUBLIC_BASE_URL") ||
    env("NEXT_PUBLIC_SITE_URL") ||
    env("NEXT_PUBLIC_APP_URL");
  if (explicit) return explicit.replace(/\/+$/, "");

  const expectedHostname = env("TURNSTILE_EXPECTED_HOSTNAME", "ceplife.com");
  if (!expectedHostname) return "https://ceplife.com";
  return `https://${expectedHostname}`.replace(/\/+$/, "");
}

function getLogoUrl() {
  return `${getPublicSiteUrl()}${LOGO_PATH}`;
}

function getOrderStatusLabel(order) {
  if (order?.status === "paid" || order?.payment?.status === "success") {
    return "Ödeme alındı";
  }
  if (order?.status === "pending") return "Onay bekleniyor";
  if (order?.status === "shipped") return "Kargoya verildi";
  if (order?.status === "completed") return "Tamamlandı";
  if (order?.status === "cancelled") return "İptal edildi";
  return "İşleme alındı";
}

function getOrderAddress(order) {
  return [
    order?.address?.addressLine,
    order?.address?.district,
    order?.address?.city,
    order?.address?.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function getOrderCustomerEmail(order, user) {
  return String(user?.email || order?.payment?.payer?.email || "").trim();
}

function getOrderCustomerName(order, user, fallback = "Müşterimiz") {
  return String(
    order?.address?.fullName ||
      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
      fallback
  ).trim();
}

function getCampaignRows(order) {
  const rows = [];
  const standardDiscountAmount = Number(order?.pricing?.standardDiscountAmount || 0);
  const stackedDiscountAmount = Number(order?.pricing?.stackedDiscountAmount || 0);
  const couponDiscountAmount = Number(order?.pricing?.couponDiscountAmount || 0);

  if (standardDiscountAmount > 0) {
    rows.push({
      label: "Kampanya indirimi",
      amount: -standardDiscountAmount,
    });
  }
  if (stackedDiscountAmount > 0) {
    rows.push({
      label: "Ek kampanya indirimi",
      amount: -stackedDiscountAmount,
    });
  }
  if (couponDiscountAmount > 0) {
    const couponCode = String(order?.coupon?.code || "").trim();
    rows.push({
      label: couponCode ? `Kupon indirimi (${couponCode})` : "Kupon indirimi",
      amount: -couponDiscountAmount,
    });
  }

  return rows;
}

function formatOrderItemsHtml(items = []) {
  return (items || [])
    .map((item) => {
      const variantParts = [
        item?.variant?.color,
        item?.variant?.size,
        item?.variant?.attribute,
      ].filter(Boolean);
      return `
        <tr>
          <td style="padding:14px 16px;border-bottom:1px solid #e0f2fe;vertical-align:top">
            <div style="font-weight:700;color:${BRAND_COLOR};font-size:14px">
              ${escapeHtml(item?.name || "Ürün")}
            </div>
            ${
              variantParts.length
                ? `<div style="margin-top:4px;color:#475569;font-size:12px">${escapeHtml(
                    variantParts.join(" / ")
                  )}</div>`
                : ""
            }
          </td>
          <td style="padding:14px 16px;border-bottom:1px solid #e0f2fe;text-align:center;color:#0f172a;font-size:13px">
            ${escapeHtml(item?.qty || 1)}
          </td>
          <td style="padding:14px 16px;border-bottom:1px solid #e0f2fe;text-align:right;color:#0f172a;font-size:13px">
            ${escapeHtml(formatMoney(item?.unitPrice))}
          </td>
          <td style="padding:14px 16px;border-bottom:1px solid #e0f2fe;text-align:right;color:${BRAND_COLOR};font-size:13px;font-weight:700">
            ${escapeHtml(formatMoney(Number(item?.unitPrice || 0) * Number(item?.qty || 1)))}
          </td>
        </tr>
      `;
    })
    .join("");
}

function formatOrderItemsText(items = []) {
  return (items || [])
    .map((item) => {
      const variantParts = [
        item?.variant?.color,
        item?.variant?.size,
        item?.variant?.attribute,
      ].filter(Boolean);
      return `- ${item?.name || "Ürün"} x ${item?.qty || 1}${
        variantParts.length ? ` (${variantParts.join(" / ")})` : ""
      } | ${formatMoney(Number(item?.unitPrice || 0) * Number(item?.qty || 1))}`;
    })
    .join("\n");
}

function formatPricingTableHtml(order) {
  const campaignRows = getCampaignRows(order);
  const rows = [
    {
      label: "Ara toplam",
      value: formatMoney(order?.subtotal),
    },
    {
      label: order?.shippingName || "Kargo",
      value: formatMoney(order?.shipping),
    },
    ...campaignRows.map((row) => ({
      label: row.label,
      value: `-${formatMoney(Math.abs(row.amount))}`,
    })),
    {
      label: "Genel toplam",
      value: formatMoney(order?.total),
      strong: true,
    },
  ];

  return rows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;color:${row.strong ? BRAND_COLOR : "#475569"};font-weight:${row.strong ? "700" : "500"}">${escapeHtml(
            row.label
          )}</td>
          <td style="padding:10px 0;text-align:right;color:${row.strong ? BRAND_COLOR : "#0f172a"};font-weight:${row.strong ? "700" : "600"}">${escapeHtml(
            row.value
          )}</td>
        </tr>
      `
    )
    .join("");
}

function buildEmailShell({ preheader = "", heading, intro, bodyHtml, footerNote = "" }) {
  const logoUrl = getLogoUrl();
  return `
    <!doctype html>
    <html lang="tr">
      <body style="margin:0;padding:0;background:#eef7ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(
          preheader
        )}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef7ff;padding:28px 12px">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid ${BRAND_BORDER};border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(12,74,110,0.12)">
                <tr>
                  <td style="padding:28px 28px 20px;background:linear-gradient(180deg,#f5fbff 0%,#ffffff 100%)">
                    <div style="text-align:center">
                      <img src="${escapeHtml(
                        logoUrl
                      )}" alt="CepLife" width="180" style="margin:0 auto 18px;display:block;height:auto;max-width:180px" />
                      <div style="display:inline-block;padding:7px 14px;border-radius:999px;background:${BRAND_SURFACE};border:1px solid ${BRAND_BORDER};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_COLOR};font-weight:700">
                        CepLife Sipariş Bildirimi
                      </div>
                      <h1 style="margin:18px 0 8px;font-size:28px;line-height:1.2;color:${BRAND_COLOR}">
                        ${escapeHtml(heading)}
                      </h1>
                      <p style="margin:0 auto;max-width:540px;font-size:15px;line-height:1.7;color:#475569">
                        ${escapeHtml(intro)}
                      </p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 28px">
                    ${bodyHtml}
                    <div style="margin-top:28px;padding-top:18px;border-top:1px solid #e0f2fe;font-size:12px;line-height:1.8;color:#64748b">
                      ${footerNote || ""}
                      <div>${escapeHtml(OFFICIAL_SUPPORT_EMAIL)} · ${escapeHtml(
                        OFFICIAL_PHONE
                      )}</div>
                      <div>${escapeHtml(OFFICIAL_ADDRESS)}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export function isMailConfigured() {
  const config = getMailConfig();
  return Boolean(config.fromAddress && config.appPassword);
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const { fromAddress, appPassword } = getMailConfig();
  if (!fromAddress || !appPassword) return null;

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: fromAddress,
      pass: appPassword,
    },
  });

  return cachedTransporter;
}

async function sendEmail({ to, subject, html, text, replyTo }) {
  const transporter = getTransporter();
  const { fromAddress, fromName } = getMailConfig();

  if (!transporter) {
    logger.warn("Mail transporter not configured; skipping e-mail send");
    return { ok: false, skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      html,
      text,
      replyTo: replyTo || undefined,
    });

    return { ok: true, messageId: info?.messageId || "" };
  } catch (error) {
    logger.error(
      { err: error?.message || String(error), to, subject },
      "Mail send failed"
    );
    return { ok: false, error: error?.message || "mail-send-failed" };
  }
}

export async function sendOrderCustomerEmail({ order, user }) {
  const customerEmail = getOrderCustomerEmail(order, user);
  if (!customerEmail) return { ok: false, skipped: true };

  const customerName = getOrderCustomerName(order, user);

  const orderAddress = getOrderAddress(order);
  const campaignRows = getCampaignRows(order);
  const couponCode = String(order?.coupon?.code || "").trim();
  const note = String(order?.note || "").trim();
  const orderStatus = getOrderStatusLabel(order);
  const subject = `Siparişiniz alındı: ${order?.orderNumber || "CepLife"}`;

  const bodyHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px">
      <tr>
        <td style="padding:0 0 16px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding:0 6px 12px 0" width="50%">
                <div style="padding:18px;border:1px solid ${BRAND_BORDER};border-radius:18px;background:${BRAND_SURFACE}">
                  <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">Sipariş numarası</div>
                  <div style="margin-top:8px;font-size:18px;font-weight:700;color:${BRAND_COLOR}">${escapeHtml(
                    order?.orderNumber || ""
                  )}</div>
                </div>
              </td>
              <td style="padding:0 0 12px 6px" width="50%">
                <div style="padding:18px;border:1px solid ${BRAND_BORDER};border-radius:18px;background:${BRAND_SURFACE}">
                  <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">Sipariş durumu</div>
                  <div style="margin-top:8px;font-size:18px;font-weight:700;color:${BRAND_COLOR}">${escapeHtml(
                    orderStatus
                  )}</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <div style="padding:22px;border:1px solid ${BRAND_BORDER};border-radius:20px;background:#ffffff">
            <h2 style="margin:0 0 14px;font-size:18px;color:${BRAND_COLOR}">Sipariş özeti</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e0f2fe;border-radius:16px;overflow:hidden">
              <thead>
                <tr style="background:${BRAND_SURFACE}">
                  <th align="left" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Ürün</th>
                  <th align="center" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Adet</th>
                  <th align="right" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Birim</th>
                  <th align="right" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Tutar</th>
                </tr>
              </thead>
              <tbody>
                ${formatOrderItemsHtml(order?.items)}
              </tbody>
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px">
              ${formatPricingTableHtml(order)}
            </table>

            ${
              couponCode || campaignRows.length
                ? `
                  <div style="margin-top:18px;padding:16px;border-radius:16px;background:${BRAND_SURFACE};border:1px solid ${BRAND_BORDER}">
                    <div style="font-size:13px;font-weight:700;color:${BRAND_COLOR};margin-bottom:8px">Kampanya ve indirim bilgisi</div>
                    ${
                      couponCode
                        ? `<div style="font-size:14px;color:#334155">Kullanılan kupon: <strong>${escapeHtml(
                            couponCode
                          )}</strong></div>`
                        : ""
                    }
                    ${
                      campaignRows.length
                        ? `<div style="margin-top:6px;font-size:14px;color:#334155">${campaignRows
                            .map(
                              (row) =>
                                `${escapeHtml(row.label)}: <strong>-${escapeHtml(
                                  formatMoney(Math.abs(row.amount))
                                )}</strong>`
                            )
                            .join("<br />")}</div>`
                        : ""
                    }
                  </div>
                `
                : ""
            }

            ${
              note
                ? `
                  <div style="margin-top:18px;padding:16px;border-radius:16px;background:#f8fbff;border:1px dashed ${BRAND_BORDER}">
                    <div style="font-size:13px;font-weight:700;color:${BRAND_COLOR};margin-bottom:8px">Sipariş notunuz</div>
                    <div style="font-size:14px;line-height:1.7;color:#334155">${escapeHtml(
                      note
                    )}</div>
                  </div>
                `
                : ""
            }
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding-top:18px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding:0 6px 12px 0" width="50%">
                <div style="padding:18px;border:1px solid ${BRAND_BORDER};border-radius:18px;background:${BRAND_SURFACE};height:100%">
                  <div style="font-size:13px;font-weight:700;color:${BRAND_COLOR};margin-bottom:8px">Teslimat bilgisi</div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">${escapeHtml(
                    customerName
                  )}</div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">${escapeHtml(
                    orderAddress || "-"
                  )}</div>
                </div>
              </td>
              <td style="padding:0 0 12px 6px" width="50%">
                <div style="padding:18px;border:1px solid ${BRAND_BORDER};border-radius:18px;background:${BRAND_SURFACE};height:100%">
                  <div style="font-size:13px;font-weight:700;color:${BRAND_COLOR};margin-bottom:8px">İletişim ve destek</div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">Sipariş tarihi: ${escapeHtml(
                    formatDate(order?.createdAt || new Date())
                  )}</div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">E-posta: <a href="mailto:${escapeHtml(
                    OFFICIAL_SUPPORT_EMAIL
                  )}" style="color:${BRAND_COLOR};text-decoration:none">${escapeHtml(
                    OFFICIAL_SUPPORT_EMAIL
                  )}</a></div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">Telefon: ${escapeHtml(
                    OFFICIAL_PHONE
                  )}</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = buildEmailShell({
    preheader: `${order?.orderNumber || ""} numaralı siparişiniz başarıyla alındı.`,
    heading: "Siparişiniz başarıyla alındı",
    intro:
      "Siparişinizi teslim aldık. Hazırlık ve sevkiyat sürecinde önemli güncellemeleri sizinle paylaşacağız.",
    bodyHtml,
    footerNote:
      "Bu e-posta otomatik olarak oluşturulmuştur. Siparişinizle ilgili desteğe ihtiyaç duyarsanız bize resmi iletişim kanallarımızdan ulaşabilirsiniz.",
  });

  const text = [
    `Merhaba ${customerName},`,
    "",
    `${order?.orderNumber || ""} numaralı siparişiniz başarıyla alındı.`,
    `Durum: ${orderStatus}`,
    `Sipariş tarihi: ${formatDate(order?.createdAt || new Date())}`,
    "",
    "Ürünler:",
    formatOrderItemsText(order?.items),
    "",
    "Özet:",
    `Ara toplam: ${formatMoney(order?.subtotal)}`,
    `${order?.shippingName || "Kargo"}: ${formatMoney(order?.shipping)}`,
    ...getCampaignRows(order).map(
      (row) => `${row.label}: -${formatMoney(Math.abs(row.amount))}`
    ),
    `Genel toplam: ${formatMoney(order?.total)}`,
    couponCode ? `Kullanılan kupon: ${couponCode}` : "",
    note ? `Sipariş notu: ${note}` : "",
    "",
    `Teslimat adresi: ${orderAddress || "-"}`,
    `Destek: ${OFFICIAL_SUPPORT_EMAIL}`,
    `Telefon: ${OFFICIAL_PHONE}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: customerEmail,
    subject,
    html,
    text,
  });
}

export async function sendOrderShippedEmail({ order, user }) {
  const customerEmail = getOrderCustomerEmail(order, user);
  if (!customerEmail) return { ok: false, skipped: true };

  const customerName = getOrderCustomerName(order, user);
  const orderAddress = getOrderAddress(order);
  const orderStatus = getOrderStatusLabel(order);
  const subject = `Siparişiniz kargoya verildi: ${order?.orderNumber || "CepLife"}`;

  const bodyHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px">
      <tr>
        <td style="padding:0 0 16px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding:0 6px 12px 0" width="50%">
                <div style="padding:18px;border:1px solid ${BRAND_BORDER};border-radius:18px;background:${BRAND_SURFACE}">
                  <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">Sipariş numarası</div>
                  <div style="margin-top:8px;font-size:18px;font-weight:700;color:${BRAND_COLOR}">${escapeHtml(
                    order?.orderNumber || ""
                  )}</div>
                </div>
              </td>
              <td style="padding:0 0 12px 6px" width="50%">
                <div style="padding:18px;border:1px solid ${BRAND_BORDER};border-radius:18px;background:${BRAND_SURFACE}">
                  <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">Güncel durum</div>
                  <div style="margin-top:8px;font-size:18px;font-weight:700;color:${BRAND_COLOR}">${escapeHtml(
                    orderStatus
                  )}</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <div style="padding:22px;border:1px solid ${BRAND_BORDER};border-radius:20px;background:#ffffff">
            <div style="padding:16px 18px;border-radius:18px;background:${BRAND_SURFACE};border:1px solid ${BRAND_BORDER};font-size:14px;line-height:1.8;color:#334155">
              Siparişiniz kargoya verildi. Teslimat sürecinde olası sorularınız için bize ulaşabilirsiniz.
            </div>

            <h2 style="margin:20px 0 14px;font-size:18px;color:${BRAND_COLOR}">Sipariş özeti</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e0f2fe;border-radius:16px;overflow:hidden">
              <thead>
                <tr style="background:${BRAND_SURFACE}">
                  <th align="left" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Ürün</th>
                  <th align="center" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Adet</th>
                  <th align="right" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Birim</th>
                  <th align="right" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Tutar</th>
                </tr>
              </thead>
              <tbody>
                ${formatOrderItemsHtml(order?.items)}
              </tbody>
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px">
              ${formatPricingTableHtml(order)}
            </table>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding-top:18px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="padding:0 6px 12px 0" width="50%">
                <div style="padding:18px;border:1px solid ${BRAND_BORDER};border-radius:18px;background:${BRAND_SURFACE};height:100%">
                  <div style="font-size:13px;font-weight:700;color:${BRAND_COLOR};margin-bottom:8px">Teslimat bilgisi</div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">${escapeHtml(
                    customerName
                  )}</div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">${escapeHtml(
                    orderAddress || "-"
                  )}</div>
                </div>
              </td>
              <td style="padding:0 0 12px 6px" width="50%">
                <div style="padding:18px;border:1px solid ${BRAND_BORDER};border-radius:18px;background:${BRAND_SURFACE};height:100%">
                  <div style="font-size:13px;font-weight:700;color:${BRAND_COLOR};margin-bottom:8px">İletişim ve destek</div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">Sipariş tarihi: ${escapeHtml(
                    formatDate(order?.createdAt || new Date())
                  )}</div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">E-posta: <a href="mailto:${escapeHtml(
                    OFFICIAL_SUPPORT_EMAIL
                  )}" style="color:${BRAND_COLOR};text-decoration:none">${escapeHtml(
                    OFFICIAL_SUPPORT_EMAIL
                  )}</a></div>
                  <div style="font-size:14px;line-height:1.7;color:#334155">Telefon: ${escapeHtml(
                    OFFICIAL_PHONE
                  )}</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = buildEmailShell({
    preheader: `${order?.orderNumber || ""} numaralı siparişiniz kargoya verildi.`,
    heading: "Siparişiniz kargoya verildi",
    intro:
      "Siparişiniz sevkiyata çıktı. Teslimat sürecinde ihtiyaç duyarsanız destek ekibimiz size yardımcı olacaktır.",
    bodyHtml,
    footerNote:
      "Bu e-posta otomatik olarak oluşturulmuştur. Siparişinizle ilgili desteğe ihtiyaç duyarsanız bize resmi iletişim kanallarımızdan ulaşabilirsiniz.",
  });

  const text = [
    `Merhaba ${customerName},`,
    "",
    `${order?.orderNumber || ""} numaralı siparişiniz kargoya verildi.`,
    `Durum: ${orderStatus}`,
    `Sipariş tarihi: ${formatDate(order?.createdAt || new Date())}`,
    "",
    "Ürünler:",
    formatOrderItemsText(order?.items),
    "",
    "Özet:",
    `Ara toplam: ${formatMoney(order?.subtotal)}`,
    `${order?.shippingName || "Kargo"}: ${formatMoney(order?.shipping)}`,
    `Genel toplam: ${formatMoney(order?.total)}`,
    "",
    `Teslimat adresi: ${orderAddress || "-"}`,
    `Destek: ${OFFICIAL_SUPPORT_EMAIL}`,
    `Telefon: ${OFFICIAL_PHONE}`,
  ].join("\n");

  return sendEmail({
    to: customerEmail,
    subject,
    html,
    text,
  });
}

export async function sendOrderAdminEmail({ order, user }) {
  const { adminInbox } = getMailConfig();
  if (!adminInbox) return { ok: false, skipped: true };

  const customerName = getOrderCustomerName(order, user, "Müşteri");
  const customerEmail = getOrderCustomerEmail(order, user);
  const customerPhone = String(order?.address?.phone || user?.phone || "").trim();
  const note = String(order?.note || "").trim();
  const couponCode = String(order?.coupon?.code || "").trim();
  const orderAddress = getOrderAddress(order);

  const bodyHtml = `
    <div style="margin-top:22px;padding:22px;border:1px solid ${BRAND_BORDER};border-radius:20px;background:#ffffff">
      <h2 style="margin:0 0 14px;font-size:18px;color:${BRAND_COLOR}">Yeni sipariş detayları</h2>
      <div style="font-size:14px;line-height:1.8;color:#334155">
        <div><strong>Sipariş No:</strong> ${escapeHtml(order?.orderNumber || "")}</div>
        <div><strong>Müşteri:</strong> ${escapeHtml(customerName)}</div>
        <div><strong>E-posta:</strong> ${escapeHtml(customerEmail || "-")}</div>
        <div><strong>Telefon:</strong> ${escapeHtml(customerPhone || "-")}</div>
        <div><strong>Toplam:</strong> ${escapeHtml(formatMoney(order?.total))}</div>
        <div><strong>Adres:</strong> ${escapeHtml(orderAddress || "-")}</div>
        ${
          couponCode
            ? `<div><strong>Kupon:</strong> ${escapeHtml(couponCode)}</div>`
            : ""
        }
        ${
          note
            ? `<div style="margin-top:10px"><strong>Sipariş notu:</strong><br />${escapeHtml(
                note
              )}</div>`
            : ""
        }
      </div>
      <div style="margin-top:18px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e0f2fe;border-radius:16px;overflow:hidden">
          <thead>
            <tr style="background:${BRAND_SURFACE}">
              <th align="left" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Ürün</th>
              <th align="center" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Adet</th>
              <th align="right" style="padding:14px 16px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${(order?.items || [])
              .map((item) => {
                const variantParts = [
                  item?.variant?.color,
                  item?.variant?.size,
                  item?.variant?.attribute,
                ].filter(Boolean);
                return `
                  <tr>
                    <td style="padding:14px 16px;border-bottom:1px solid #e0f2fe">
                      <strong>${escapeHtml(item?.name || "Ürün")}</strong>
                      ${
                        variantParts.length
                          ? `<div style="margin-top:4px;font-size:12px;color:#64748b">${escapeHtml(
                              variantParts.join(" / ")
                            )}</div>`
                          : ""
                      }
                    </td>
                    <td style="padding:14px 16px;border-bottom:1px solid #e0f2fe;text-align:center">${escapeHtml(
                      item?.qty || 1
                    )}</td>
                    <td style="padding:14px 16px;border-bottom:1px solid #e0f2fe;text-align:right">${escapeHtml(
                      formatMoney(Number(item?.unitPrice || 0) * Number(item?.qty || 1))
                    )}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const html = buildEmailShell({
    preheader: `${order?.orderNumber || ""} numaralı yeni sipariş oluşturuldu.`,
    heading: "Yeni sipariş geldi",
    intro: "Müşteri siparişi başarıyla oluşturdu. Aşağıda siparişin kurumsal özetini bulabilirsiniz.",
    bodyHtml,
    footerNote:
      "Bu bildirim CepLife sipariş sistemi tarafından otomatik gönderilmiştir.",
  });

  const text = [
    "Yeni sipariş geldi",
    `Sipariş No: ${order?.orderNumber || ""}`,
    `Müşteri: ${customerName}`,
    `E-posta: ${customerEmail || "-"}`,
    `Telefon: ${customerPhone || "-"}`,
    `Toplam: ${formatMoney(order?.total)}`,
    `Adres: ${orderAddress || "-"}`,
    couponCode ? `Kupon: ${couponCode}` : "",
    note ? `Sipariş notu: ${note}` : "",
    "",
    "Ürünler:",
    formatOrderItemsText(order?.items),
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: adminInbox,
    subject: `Yeni sipariş geldi: ${order?.orderNumber || ""}`,
    html,
    text,
    replyTo: customerEmail || undefined,
  });
}

export async function sendContactMessageAdminEmail({ message }) {
  const { adminInbox } = getMailConfig();
  if (!adminInbox || !message) return { ok: false, skipped: true };

  const bodyHtml = `
    <div style="margin-top:22px;padding:22px;border:1px solid ${BRAND_BORDER};border-radius:20px;background:#ffffff">
      <h2 style="margin:0 0 14px;font-size:18px;color:${BRAND_COLOR}">İletişim formu mesajı</h2>
      <div style="font-size:14px;line-height:1.8;color:#334155">
        <div><strong>Ad Soyad:</strong> ${escapeHtml(message.name || "-")}</div>
        <div><strong>E-posta:</strong> ${escapeHtml(message.email || "-")}</div>
        <div><strong>Telefon:</strong> ${escapeHtml(message.phone || "-")}</div>
        <div><strong>Konu:</strong> ${escapeHtml(message.subject || "-")}</div>
      </div>
      <div style="margin-top:16px;padding:16px;border-radius:16px;background:${BRAND_SURFACE};border:1px solid ${BRAND_BORDER};white-space:pre-wrap;color:#334155">
        ${escapeHtml(message.message || "")}
      </div>
    </div>
  `;

  const html = buildEmailShell({
    preheader: `${message.subject || "Konu yok"} başlıklı yeni iletişim formu mesajı.`,
    heading: "Yeni iletişim formu mesajı",
    intro: "Web sitesindeki iletişim formundan yeni bir mesaj alındı.",
    bodyHtml,
    footerNote:
      "Bu bildirim CepLife iletişim formu tarafından otomatik gönderilmiştir.",
  });

  const text = [
    "Yeni iletişim formu mesajı",
    `Ad Soyad: ${message.name || "-"}`,
    `E-posta: ${message.email || "-"}`,
    `Telefon: ${message.phone || "-"}`,
    `Konu: ${message.subject || "-"}`,
    "",
    `${message.message || ""}`,
  ].join("\n");

  return sendEmail({
    to: adminInbox,
    subject: `Yeni iletişim formu mesajı: ${message.subject || "Konu yok"}`,
    html,
    text,
    replyTo: message.email || undefined,
  });
}

export async function sendPaymentManualReviewAdminEmail({
  paymentSession,
  user = null,
}) {
  const { adminInbox } = getMailConfig();
  if (!adminInbox || !paymentSession) return { ok: false, skipped: true };

  const customerName = String(
    paymentSession?.addressSnapshot?.fullName ||
      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
      "Müşteri"
  ).trim();
  const customerEmail = String(user?.email || "").trim();
  const customerPhone = String(
    paymentSession?.addressSnapshot?.phone || user?.phone || ""
  ).trim();
  const address = [
    paymentSession?.addressSnapshot?.addressLine,
    paymentSession?.addressSnapshot?.district,
    paymentSession?.addressSnapshot?.city,
    paymentSession?.addressSnapshot?.postalCode,
    paymentSession?.addressSnapshot?.country,
  ]
    .filter(Boolean)
    .join(", ");
  const reservationEntries = Array.isArray(paymentSession?.stockReservation?.entries)
    ? paymentSession.stockReservation.entries
    : [];
  const reservationState = String(paymentSession?.stockReservation?.state || "none");
  const paymentId = String(paymentSession?.payment?.paymentId || "").trim();
  const errorMessage = String(paymentSession?.lastError?.message || "").trim();
  const errorCode = String(paymentSession?.lastError?.code || "").trim();
  const errorPhase = String(paymentSession?.lastError?.phase || "").trim();
  const conversationId = String(paymentSession?.conversationId || "").trim();
  const total = formatMoney(paymentSession?.pricing?.total || 0);
  const createdAt = formatDate(paymentSession?.createdAt);
  const sessionId =
    paymentSession?._id?.toString?.() || String(paymentSession?._id || "");

  const bodyHtml = `
    <div style="margin-top:22px;padding:22px;border:1px solid ${BRAND_BORDER};border-radius:20px;background:#ffffff">
      <h2 style="margin:0 0 14px;font-size:18px;color:${BRAND_COLOR}">Manual review gereken ödeme</h2>
      <div style="font-size:14px;line-height:1.8;color:#334155">
        <div><strong>Session ID:</strong> ${escapeHtml(sessionId || "-")}</div>
        <div><strong>Conversation ID:</strong> ${escapeHtml(conversationId || "-")}</div>
        <div><strong>Payment ID:</strong> ${escapeHtml(paymentId || "-")}</div>
        <div><strong>Tutar:</strong> ${escapeHtml(total)}</div>
        <div><strong>Müşteri:</strong> ${escapeHtml(customerName || "-")}</div>
        <div><strong>E-posta:</strong> ${escapeHtml(customerEmail || "-")}</div>
        <div><strong>Telefon:</strong> ${escapeHtml(customerPhone || "-")}</div>
        <div><strong>Adres:</strong> ${escapeHtml(address || "-")}</div>
        <div><strong>Rezervasyon:</strong> ${escapeHtml(reservationState)} (${reservationEntries.length} satır)</div>
        <div><strong>Hata aşaması:</strong> ${escapeHtml(errorPhase || "-")}</div>
        <div><strong>Hata kodu:</strong> ${escapeHtml(errorCode || "-")}</div>
        <div><strong>Oluşturulma:</strong> ${escapeHtml(createdAt || "-")}</div>
      </div>
      <div style="margin-top:16px;padding:16px;border-radius:16px;background:${BRAND_SURFACE};border:1px solid ${BRAND_BORDER};color:#334155">
        <strong style="display:block;margin-bottom:8px;color:${BRAND_COLOR}">Açıklama</strong>
        ${escapeHtml(errorMessage || "Ödeme manuel kontrole alındı.")}
      </div>
      ${
        reservationEntries.length
          ? `
            <div style="margin-top:16px;padding:16px;border-radius:16px;background:#f8fbff;border:1px solid ${BRAND_BORDER}">
              <strong style="display:block;margin-bottom:8px;color:${BRAND_COLOR}">Rezerve edilen stok kalemleri</strong>
              <div style="font-size:13px;line-height:1.8;color:#334155">
                ${reservationEntries
                  .map((entry) => {
                    const variant = [
                      entry?.color,
                      entry?.size,
                      entry?.attribute,
                    ]
                      .filter(Boolean)
                      .join(" / ");
                    return `${escapeHtml(entry?.productName || entry?.productId || "Ürün")} × ${escapeHtml(entry?.qty || 0)}${
                      variant ? ` (${escapeHtml(variant)})` : ""
                    }`;
                  })
                  .join("<br />")}
              </div>
            </div>
          `
          : ""
      }
    </div>
  `;

  const html = buildEmailShell({
    preheader: `Manual review gereken ödeme: ${conversationId || sessionId}`,
    heading: "Ödeme manuel kontrole alındı",
    intro:
      "Iyzico ödeme akışında otomatik finalize edilemeyen bir işlem tespit edildi. Müşteriyle gerektiğinde iletişime geçerek sipariş veya iade sürecini kontrol edin.",
    bodyHtml,
    footerNote:
      "Bu bildirim CepLife ödeme sistemi tarafından otomatik gönderilmiştir.",
  });

  const text = [
    "Manual review gereken ödeme",
    `Session ID: ${sessionId || "-"}`,
    `Conversation ID: ${conversationId || "-"}`,
    `Payment ID: ${paymentId || "-"}`,
    `Tutar: ${total}`,
    `Müşteri: ${customerName || "-"}`,
    `E-posta: ${customerEmail || "-"}`,
    `Telefon: ${customerPhone || "-"}`,
    `Adres: ${address || "-"}`,
    `Rezervasyon: ${reservationState} (${reservationEntries.length} satır)`,
    `Hata aşaması: ${errorPhase || "-"}`,
    `Hata kodu: ${errorCode || "-"}`,
    `Oluşturulma: ${createdAt || "-"}`,
    "",
    errorMessage || "Ödeme manuel kontrole alındı.",
    reservationEntries.length
      ? [
          "",
          "Rezerve edilen stok kalemleri:",
          ...reservationEntries.map((entry) => {
            const variant = [entry?.color, entry?.size, entry?.attribute]
              .filter(Boolean)
              .join(" / ");
            return `- ${entry?.productName || entry?.productId || "Ürün"} x ${
              entry?.qty || 0
            }${variant ? ` (${variant})` : ""}`;
          }),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: adminInbox,
    subject: `Manual review ödeme uyarısı: ${conversationId || sessionId}`,
    html,
    text,
    replyTo: customerEmail || undefined,
  });
}
