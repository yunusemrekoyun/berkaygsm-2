/**
 * MNG Kargo (DHL eCommerce Turkey) REST API entegrasyonu
 *
 * Env değişkenleri:
 *   MNG_API_BASE_URL      - https://testapi.mngkargo.com.tr/mngapi/api  (sandbox)
 *                           https://apizone.mngkargo.com.tr/mngapi/api  (canlı)
 *   MNG_CLIENT_ID         - IBM API Connect x-ibm-client-id
 *   MNG_CLIENT_SECRET     - IBM API Connect x-ibm-client-secret
 *   MNG_CUSTOMER_NUMBER   - MNG müşteri numarası
 *   MNG_PASSWORD          - MNG API şifresi
 *   MNG_DEFAULT_DESI      - Varsayılan desi (ör. 1)
 *   MNG_DEFAULT_KG        - Varsayılan kg  (ör. 0.5)
 */

const BASE_URL = process.env.MNG_API_BASE_URL || "https://testapi.mngkargo.com.tr/mngapi/api";
const CLIENT_ID = process.env.MNG_CLIENT_ID || "";
const CLIENT_SECRET = process.env.MNG_CLIENT_SECRET || "";
const CUSTOMER_NUMBER = process.env.MNG_CUSTOMER_NUMBER || "";
const PASSWORD = process.env.MNG_PASSWORD || "";
const DEFAULT_DESI = Number(process.env.MNG_DEFAULT_DESI || 1);
const DEFAULT_KG = Number(process.env.MNG_DEFAULT_KG || 0.5);

// --- Token önbelleği ---
let _cachedToken = null;
let _tokenExpiresAt = 0;

function isConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && CUSTOMER_NUMBER && PASSWORD);
}

async function fetchToken() {
  const url = `${BASE_URL}/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ibm-client-id": CLIENT_ID,
      "x-ibm-client-secret": CLIENT_SECRET,
    },
    body: JSON.stringify({
      customerNumber: CUSTOMER_NUMBER,
      password: PASSWORD,
      identityType: 1,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MNG token alınamadı (${res.status}): ${text}`);
  }

  const data = await res.json();
  // API genellikle { token: "...", expiresIn: 3600 } döner
  const token = data.jwt || data.token || data.access_token || data.Token;
  if (!token) throw new Error("MNG token yanıtı geçersiz: token alanı yok");

  // MNG "jwtExpireDate" döndürür: "10.03.2020 16:05:00" formatında
  // Bunu parse etmek yerine sabit 50 dakika kullan (güvenli tampon)
  const expiresIn = Number(data.expiresIn || data.expires_in || 3600);
  _cachedToken = token;
  // Sürenin %80'inde yenile (güvenli tampon)
  _tokenExpiresAt = Date.now() + expiresIn * 1000 * 0.8;
  return token;
}

async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpiresAt) {
    return _cachedToken;
  }
  return fetchToken();
}

function ibmHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-ibm-client-id": CLIENT_ID,
    "x-ibm-client-secret": CLIENT_SECRET,
  };
}

function normalizeString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function asObjectList(payload) {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === "object");
  }
  if (payload && typeof payload === "object") {
    return [payload];
  }
  return [];
}

function firstDefined(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return null;
}

export function parseCreateOrderResponse(payload, fallbackReferenceId = "") {
  const [entry = null] = asObjectList(payload);
  const referenceId = normalizeString(
    firstDefined(entry?.referenceId, fallbackReferenceId)
  );
  const shipmentId = normalizeString(
    firstDefined(
      entry?.orderInvoiceId,
      entry?.orderInvoiceDetailId,
      entry?.shipmentId,
      entry?.shipmentNumber
    )
  );

  return {
    shipmentId,
    referenceId,
    orderInvoiceId: normalizeString(entry?.orderInvoiceId),
    orderInvoiceDetailId: normalizeString(entry?.orderInvoiceDetailId),
    shipperBranchCode: normalizeString(entry?.shipperBranchCode),
    raw: entry,
  };
}

export function normalizeShipmentRecord(payload, fallbackReferenceId = "") {
  const [entry = null] = asObjectList(payload);
  const shipment = entry?.shipment && typeof entry.shipment === "object"
    ? entry.shipment
    : null;

  return {
    raw: entry,
    shipment: shipment || null,
    referenceId: normalizeString(
      firstDefined(entry?.referenceId, shipment?.referenceId, fallbackReferenceId)
    ),
    shipmentId: normalizeString(
      firstDefined(
        entry?.shipmentId,
        entry?.orderInvoiceId,
        entry?.orderInvoiceDetailId,
        shipment?.shipmentId,
        shipment?.shipmentNumber
      )
    ),
    barcode: normalizeString(
      firstDefined(entry?.barcode, shipment?.barcode, shipment?.shipmentNumber)
    ),
    trackingUrl: normalizeString(
      firstDefined(entry?.trackingUrl, shipment?.trackingUrl)
    ),
    statusCode: firstDefined(
      entry?.shipmentStatusCode,
      entry?.statusCode,
      shipment?.shipmentStatusCode,
      shipment?.statusCode
    ),
    estimatedDeliveryDate: normalizeString(
      firstDefined(
        entry?.estimatedDeliveryDate,
        shipment?.estimatedDeliveryDate,
        shipment?.deliveryDate
      )
    ),
  };
}

// --- Kargo Kaydı Oluşturma ---

/**
 * Siparişi MNG sistemine kargo olarak kaydeder.
 * @param {object} order  - Mongoose Order belgesi (address, customer, orderNumber alanları dolu olmalı)
 * @returns {{ barcode, trackingUrl, shipmentId, referenceId, estimatedDeliveryDate }}
 */
export async function createShipment(order) {
  if (!isConfigured()) {
    throw new Error("MNG Kargo API bilgileri eksik. Lütfen .env dosyasını kontrol edin.");
  }

  const token = await getToken();

  const phone = String(
    order.address?.phone || order.customer?.phone || ""
  ).replace(/\D/g, "").replace(/^0+/, "").slice(0, 10);

  // Spec: barcode must be same as referenceId, uppercase
  const referenceId = order.orderNumber.toUpperCase();
  // Piece barcode: parça bazlı ayrı barkod
  const pieceBarcode = `${referenceId}-P1`;
  // desi ve kg integer olmalı (spec: int32), minimum 1
  const desi = Math.max(1, Math.ceil(DEFAULT_DESI));
  const kg = Math.max(1, Math.ceil(DEFAULT_KG));

  const body = {
    order: {
      referenceId,
      barcode: referenceId,           // spec: "Barcode must be same with ReferenceId"
      shipmentServiceType: 1,         // 1: STANDART_TESLİMAT
      packagingType: 3,               // 3: PAKET
      content: "Ürün",
      description: referenceId,
      paymentType: 1,                 // 1: GONDERICI_ODER (gönderici öder)
      deliveryType: 1,                // 1: ADRESE_TESLIM
      smsPreference1: 1,              // varış şubesine ulaşınca alıcıya SMS
      smsPreference2: 0,
      smsPreference3: 0,
      isCOD: 0,
      codAmount: 0,
      marketPlaceShortCode: "",
      marketPlaceSaleCode: "",
      pudoId: "",
    },
    orderPieceList: [
      {
        barcode: pieceBarcode,
        desi,                          // int32
        kg,                            // int32 (field adı "kg", "weight" değil)
        content: "Ürün",
      },
    ],
    recipient: {
      fullName: order.address?.fullName || order.customer?.fullName || "",
      address: order.address?.addressLine || "",
      cityCode: 0,                    // CBS Info API'den alınabilir, 0 ile cityName kabul edilir
      districtCode: 0,
      cityName: order.address?.city || "",
      districtName: order.address?.district || "",
      mobilePhoneNumber: phone,
      email: order.customer?.email || "",
    },
  };

  const url = `${BASE_URL}/standardcmdapi/createOrder`;
  const res = await fetch(url, {
    method: "POST",
    headers: ibmHeaders(token),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MNG kargo oluşturulamadı (${res.status}): ${text}`);
  }

  const data = await res.json();

  const parsed = parseCreateOrderResponse(data, referenceId);

  console.log("MNG createOrder response:", JSON.stringify(data, null, 2));
  console.log("MNG createOrder parsed:", {
    orderNumber: order.orderNumber,
    referenceId: parsed.referenceId,
    shipmentId: parsed.shipmentId,
    orderInvoiceId: parsed.orderInvoiceId,
    orderInvoiceDetailId: parsed.orderInvoiceDetailId,
    shipperBranchCode: parsed.shipperBranchCode,
  });

  if (!parsed.shipmentId) {
    console.warn("MNG createOrder response missing shipment id fields", {
      orderNumber: order.orderNumber,
      referenceId,
      responseType: Array.isArray(data) ? "array" : typeof data,
      responseLength: Array.isArray(data) ? data.length : undefined,
    });
  }

  return {
    barcode: null,
    trackingUrl: null,
    shipmentId: parsed.shipmentId,
    referenceId: parsed.referenceId || referenceId,
    estimatedDeliveryDate: null,
  };
}

// --- Durum Senkronizasyonu (Cron) ---

/** MNG kargo durum kodları */
export const MNG_STATUS = {
  1: "Gönderi Hazırlandı",
  2: "Transfer Aşamasında",
  3: "Teslimat Birimine Ulaştı",
  4: "Alıcı Adresine Yönlendirildi",
  5: "Teslim Edildi",
  6: "Teslim Edilemedi",
  7: "Geri Geliyor",
  8: "Destek Gerekiyor",
};

/**
 * Son N dakikada durum değişen tüm gönderileri MNG'den çeker.
 * Cron job tarafından kullanılır.
 * @param {Date} since
 * @returns {Array} - MNG'den gelen gönderi listesi
 */
export async function fetchStatusChangedShipments(since) {
  if (!isConfigured()) {
    throw new Error("MNG Kargo API bilgileri eksik.");
  }

  const token = await getToken();

  const pad = (n) => String(n).padStart(2, "0");
  const d = since instanceof Date ? since : new Date(since);
  const statusDate = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const statusDateTime = `${statusDate}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

  const url = `${BASE_URL}/bulkqueryapi/getStatusChangedShipments/${statusDate}/${statusDateTime}`;
  const res = await fetch(url, { headers: ibmHeaders(token), signal: AbortSignal.timeout(15_000) });

  if (res.status === 404) return []; // O tarihte değişen yoktur
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MNG durum sorgusu başarısız (${res.status}): ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Tek bir siparişin güncel durumunu MNG'den sorgular (referenceId ile).
 * @param {string} referenceId - Siparişin orderNumber değeri
 * @returns {object|null}
 */
export async function fetchShipmentByReference(referenceId) {
  if (!isConfigured()) return null;

  const token = await getToken();
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;

  // Bugünün gönderilerini getir, referenceId ile filtrele
  const url = `${BASE_URL}/bulkqueryapi/getShipmentByDate/${dateStr}`;
  const res = await fetch(url, { headers: ibmHeaders(token), signal: AbortSignal.timeout(15_000) });

  if (!res.ok) return null;
  const data = await res.json();
  const list = Array.isArray(data) ? data : [];
  return (
    list.find(
      (item) =>
        normalizeShipmentRecord(item, referenceId).referenceId === referenceId
    ) || null
  );
}
