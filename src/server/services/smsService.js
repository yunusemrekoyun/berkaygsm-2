/**
 * iletimerkezi.com SMS servisi
 *
 * Gerekli env değişkenleri:
 *   ILETIMERKEZI_KEY    — Panel > Ayarlar > Güvenlik > API Anahtarı
 *   ILETIMERKEZI_HASH   — Panel > Ayarlar > Güvenlik > API Hash
 *   ILETIMERKEZI_SENDER — Onaylı gönderici başlığı (maks 11 karakter, ör: BERKAYGSM)
 *
 * SMS gönderimi devre dışı bırakmak için ILETIMERKEZI_KEY'i boş bırak.
 */

const API_URL = "https://api.iletimerkezi.com/v1/send-sms/json";

const KEY    = process.env.ILETIMERKEZI_KEY    || "";
const HASH   = process.env.ILETIMERKEZI_HASH   || "";
const SENDER = process.env.ILETIMERKEZI_SENDER || "";

function isConfigured() {
  return Boolean(KEY && HASH && SENDER);
}

/**
 * Telefon numarasını 905XXXXXXXXX formatına normalize eder.
 * Sadece Türkiye (+90) numaralarını kabul eder — diğerleri null döner.
 *
 * DB'deki tüm numaralar formatTrPhoneForSubmit() ile +90XXXXXXXXXX olarak kaydedilir.
 * Yine de savunmacı olarak yalnızca açıkça TR olan formatları geçiriyoruz.
 */
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");

  // +90 5xx xxx xx xx → 905XXXXXXXXX (12 hane, 90 ile başlıyor)
  if (digits.startsWith("90") && digits.length === 12) return digits;

  // 05xx xxx xx xx → yerel Türk formatı (11 hane, 0 ile başlıyor)
  if (digits.startsWith("0") && digits.length === 11) return "9" + digits;

  // Diğer her şey (yabancı numara, geçersiz uzunluk) → reddet
  return null;
}

/**
 * Tek bir numaraya SMS gönderir.
 * @param {string} phone  — ham telefon numarası
 * @param {string} text   — SMS metni (max 160 karakter = 1 SMS)
 * @returns {{ ok: boolean, orderId?: string, error?: string }}
 */
export async function sendSms(phone, text) {
  if (!isConfigured()) {
    console.warn("SMS: ILETIMERKEZI_KEY/HASH/SENDER tanımlanmamış, SMS atlanıyor.");
    return { ok: false, error: "SMS yapılandırılmamış" };
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    console.warn("SMS: Geçersiz telefon numarası:", phone);
    return { ok: false, error: "Geçersiz telefon" };
  }

  const body = {
    request: {
      authentication: { key: KEY, hash: HASH },
      order: {
        sender: SENDER,
        iys: "0",        // transactional — ticari değil, İYS zorunlu değil
        message: {
          text,
          receipents: { number: [normalized] },
        },
      },
    },
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json().catch(() => ({}));
    const code = Number(data?.response?.status?.code ?? data?.status?.code ?? -1);

    if (code === 200) {
      const orderId = String(data?.response?.order?.id ?? data?.order?.id ?? "");
      return { ok: true, orderId };
    }

    const message = data?.response?.status?.message ?? data?.status?.message ?? `HTTP ${res.status}`;
    console.error("SMS gönderilemedi:", { code, message, phone: normalized });
    return { ok: false, error: message };
  } catch (err) {
    console.error("SMS istek hatası:", err?.message);
    return { ok: false, error: err?.message };
  }
}

/**
 * Sipariş alındı bildirimi
 */
export async function sendOrderReceivedSms(order) {
  const phone = order?.customer?.phone || order?.address?.phone;
  if (!phone) return { ok: false, error: "Telefon yok" };

  const orderNumber = order?.orderNumber || String(order?._id || "");
  const total       = Number(order?.total ?? 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const text =
    `Siparişiniz alındı!\n` +
    `Sipariş No: #${orderNumber}\n` +
    `Toplam: ${total} TL\n` +
    `Sorularınız için: ${process.env.SUPPORT_PHONE || ""}`.trimEnd();

  return sendSms(phone, text);
}

/**
 * Kargo barkodu ilk kez oluştuğunda gönderilir
 */
export async function sendOrderShippedSms(order) {
  const phone = order?.customer?.phone || order?.address?.phone;
  if (!phone) return { ok: false, error: "Telefon yok" };

  const orderNumber = order?.orderNumber || String(order?._id || "");
  const barcode     = order?.tracking?.barcode || order?.tracking?.shipmentId || "";

  const text =
    `Siparişiniz kargoya verildi!\n` +
    `Sipariş No: #${orderNumber}\n` +
    `MNG Kargo Takip No: ${barcode}\n` +
    `MNG şubesi veya uygulamasından takip edebilirsiniz.`;

  return sendSms(phone, text);
}
