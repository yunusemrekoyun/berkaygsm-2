/**
 * iletimerkezi.com SMS servisi
 *
 * Gerekli env değişkenleri:
 *   ILETIMERKEZI_KEY
 *   ILETIMERKEZI_HASH
 *   ILETIMERKEZI_SENDER
 *
 * Not:
 * 450 hatası devam ederse sorun büyük ihtimalle sender/headline tarafındadır.
 */

const API_URL = "https://api.iletimerkezi.com/v1/send-sms/json";

const KEY = (process.env.ILETIMERKEZI_KEY || "").trim();
const HASH = (process.env.ILETIMERKEZI_HASH || "").trim();
const SENDER = (process.env.ILETIMERKEZI_SENDER || "").trim();
const SUPPORT_PHONE = (process.env.SUPPORT_PHONE || "").trim();

function isConfigured() {
  return Boolean(KEY && HASH && SENDER);
}

function normalizePhone(raw) {
  if (!raw) return null;

  const digits = String(raw).replace(/\D/g, "");

  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `9${digits}`;
  if (digits.startsWith("5") && digits.length === 10) return `90${digits}`;

  return null;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function extractStatus(data, httpStatus) {
  const code = Number(
    data?.response?.status?.code ?? data?.status?.code ?? httpStatus ?? -1,
  );

  const message =
    data?.response?.status?.message ??
    data?.status?.message ??
    `HTTP ${httpStatus}`;

  const orderId = String(data?.response?.order?.id ?? data?.order?.id ?? "");

  return { code, message, orderId };
}

/**
 * Tek bir numaraya SMS gönderir.
 * @param {string} phone
 * @param {string} text
 * @returns {Promise<{ ok: boolean, orderId?: string, error?: string, code?: number }>}
 */
export async function sendSms(phone, text) {
  if (!isConfigured()) {
    console.warn(
      "SMS: ILETIMERKEZI_KEY/HASH/SENDER tanımlanmamış, SMS atlanıyor.",
    );
    return { ok: false, error: "SMS yapılandırılmamış" };
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    console.warn("SMS: Geçersiz telefon numarası:", phone);
    return { ok: false, error: "Geçersiz telefon" };
  }

  const smsText = normalizeText(text);

  const body = {
    request: {
      authentication: {
        key: KEY,
        hash: HASH,
      },
      order: {
        sender: SENDER,
        iys: "0",
        message: {
          text: smsText,
          receipents: {
            number: [normalized],
          },
        },
      },
    },
  };

  try {
    console.log("SMS debug:", {
      sender: JSON.stringify(SENDER),
      senderLength: SENDER.length,
      phone: normalized,
      hasKey: Boolean(KEY),
      hasHash: Boolean(HASH),
    });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    const data = await parseJsonSafe(res);
    const { code, message, orderId } = extractStatus(data, res.status);

    if (code === 200) {
      console.log("SMS gönderildi:", {
        code,
        orderId,
        phone: normalized,
      });
      return { ok: true, orderId, code };
    }

    console.error("SMS gönderilemedi:", {
      code,
      message,
      phone: normalized,
      sender: JSON.stringify(SENDER),
      senderLength: SENDER.length,
    });

    return { ok: false, error: message, code };
  } catch (err) {
    console.error("SMS istek hatası:", err?.message || err);
    return {
      ok: false,
      error: err?.message || "Bilinmeyen istek hatası",
    };
  }
}

/**
 * Sipariş alındı bildirimi
 */
export async function sendOrderReceivedSms(order) {
  const phone = order?.customer?.phone || order?.address?.phone;
  if (!phone) return { ok: false, error: "Telefon yok" };

  const orderNumber = order?.orderNumber || String(order?._id || "");
  const total = Number(order?.total ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const lines = [
    "Siparişiniz alındı.",
    `Sipariş No: #${orderNumber}`,
    `Toplam: ${total} TL`,
  ];

  if (SUPPORT_PHONE) {
    lines.push(`Destek: ${SUPPORT_PHONE}`);
  }

  return sendSms(phone, lines.join("\n"));
}

/**
 * Kargo barkodu ilk kez oluştuğunda gönderilir
 */
export async function sendOrderShippedSms(order) {
  const phone = order?.customer?.phone || order?.address?.phone;
  if (!phone) return { ok: false, error: "Telefon yok" };

  const orderNumber = order?.orderNumber || String(order?._id || "");
  const barcode = order?.tracking?.barcode || order?.tracking?.shipmentId || "";

  const lines = ["Siparişiniz kargoya verildi.", `Sipariş No: #${orderNumber}`];

  if (barcode) {
    lines.push(`MNG Kargo Takip No: ${barcode}`);
  }

  lines.push("MNG şubesi veya uygulamasından takip edebilirsiniz.");

  return sendSms(phone, lines.join("\n"));
}
