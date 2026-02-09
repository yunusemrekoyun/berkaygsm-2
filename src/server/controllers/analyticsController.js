import Order from "../models/Order.js";
import User from "../models/User.js";
import VisitEvent from "../models/VisitEvent.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DAYS = 7;
const MAX_DAYS = 180;
const DEFAULT_DAYS = 30;

const PAYMENT_METHOD_LABELS = {
  cod: "Kapıda Ödeme",
  paypal: "PayPal",
  card: "Kredi Kartı",
  bank: "Banka Havalesi",
  transfer: "Banka Havalesi",
  other: "Diğer",
};

const PAYMENT_COLORS = {
  "Kapıda Ödeme": "var(--color-primary)",
  PayPal: "var(--color-accent)",
  "Kredi Kartı": "var(--color-secondary)",
  "Banka Havalesi": "var(--color-surface)",
  Diğer: "var(--color-contact-bg)",
};

const STATUS_ORDER = ["pending", "paid", "shipped", "completed", "cancelled"];
const STATUS_LABELS = {
  pending: "Beklemede",
  paid: "Ödendi",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal",
};
const STATUS_COLORS = {
  pending: "var(--color-surface)",
  paid: "var(--color-accent)",
  shipped: "var(--color-secondary)",
  completed: "var(--color-primary)",
  cancelled: "var(--color-contact-bg)",
};

const SOURCE_ORDER = [
  "direct",
  "organic",
  "social",
  "referral",
  "paid",
  "internal",
  "other",
];
const SOURCE_LABELS = {
  direct: "Doğrudan",
  organic: "Organik Arama",
  social: "Sosyal Medya",
  referral: "Yönlendirme",
  paid: "Ücretli",
  internal: "Site İçi",
  other: "Diğer",
};
const SOURCE_COLORS = {
  direct: "var(--color-primary)",
  organic: "var(--color-accent)",
  social: "var(--color-secondary)",
  referral: "var(--color-surface)",
  paid: "var(--color-contact-bg)",
  internal: "var(--color-border-admin)",
  other: "var(--color-text-admin-muted)",
};

const DEVICE_ORDER = ["mobile", "desktop", "tablet"];
const DEVICE_LABELS = {
  mobile: "Mobil",
  desktop: "Masaüstü",
  tablet: "Tablet",
};
const DEVICE_COLORS = {
  mobile: "var(--color-accent)",
  desktop: "var(--color-primary)",
  tablet: "var(--color-secondary)",
};

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function clampDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.floor(n)));
}

function startOfDay(dateValue) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

function createDayBuckets(days) {
  const today = startOfDay(new Date());
  const start = new Date(today.getTime() - (days - 1) * DAY_MS);
  const buckets = Array.from({ length: days }).map((_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    const key = date.toISOString().slice(0, 10);
    const label = `${date.getDate()}/${date.getMonth() + 1}`;
    return { key, label };
  });
  return { start, today, buckets };
}

function percentRows(rows) {
  const total = rows.reduce((sum, row) => sum + (row.count || 0), 0);
  if (total <= 0) {
    return rows.map((row) => ({ ...row, value: 0 }));
  }
  return rows.map((row) => ({
    ...row,
    value: Math.round(((row.count || 0) / total) * 100),
  }));
}

function normalizePaymentMethod(value) {
  const normalized = String(value || "other").trim().toLowerCase();
  if (!normalized) return "Diğer";
  if (PAYMENT_METHOD_LABELS[normalized]) return PAYMENT_METHOD_LABELS[normalized];
  if (normalized.includes("pay")) return "PayPal";
  if (normalized.includes("card")) return "Kredi Kartı";
  if (normalized.includes("bank") || normalized.includes("transfer")) {
    return "Banka Havalesi";
  }
  if (normalized.includes("cod")) return "Kapıda Ödeme";
  return "Diğer";
}

function parseCountry(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.length <= 3 ? raw.toUpperCase() : raw;
}

function calculatePercentDelta(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function formatDelta(delta) {
  if (delta > 0) return `+${delta}%`;
  return `${delta}%`;
}

function normalizePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const [pathname] = raw.split("#");
  if (!pathname.startsWith("/")) return "";
  if (pathname.length > 260) return pathname.slice(0, 260);
  return pathname;
}

function normalizeSessionId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length < 8 || raw.length > 160) return "";
  if (!/^[a-zA-Z0-9._:-]+$/.test(raw)) return "";
  return raw;
}

function detectDevice(userAgentRaw) {
  const ua = String(userAgentRaw || "").toLowerCase();
  if (!ua) return "desktop";
  if (
    ua.includes("ipad") ||
    ua.includes("tablet") ||
    ua.includes("kindle") ||
    (ua.includes("android") && !ua.includes("mobile"))
  ) {
    return "tablet";
  }
  if (
    ua.includes("mobile") ||
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    ua.includes("android")
  ) {
    return "mobile";
  }
  return "desktop";
}

function deriveSource(rawSource, referrerRaw, hostRaw) {
  const normalizedSource = String(rawSource || "")
    .trim()
    .toLowerCase();
  if (SOURCE_ORDER.includes(normalizedSource)) return normalizedSource;

  const referrer = String(referrerRaw || "").trim();
  if (!referrer) return "direct";

  let refHost = "";
  try {
    refHost = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "other";
  }

  const currentHost = String(hostRaw || "")
    .trim()
    .toLowerCase()
    .split(":")[0];
  if (currentHost && refHost === currentHost) return "internal";

  if (
    refHost.includes("google.") ||
    refHost.includes("bing.") ||
    refHost.includes("duckduckgo.") ||
    refHost.includes("yahoo.")
  ) {
    return "organic";
  }

  if (
    refHost.includes("facebook.") ||
    refHost.includes("instagram.") ||
    refHost.includes("tiktok.") ||
    refHost.includes("twitter.") ||
    refHost.includes("x.com") ||
    refHost.includes("youtube.")
  ) {
    return "social";
  }

  if (
    refHost.includes("doubleclick.") ||
    refHost.includes("adservice.") ||
    refHost.includes("ads.")
  ) {
    return "paid";
  }

  return "referral";
}

function buildHeatmapFromRows(rows) {
  const heatCounts = Array.from({ length: 7 }).map(() => Array(24).fill(0));
  for (const row of rows) {
    const dow = Number(row?._id?.dow || 0);
    const hour = Number(row?._id?.hour || 0);
    const count = Number(row?.count || 0);
    if (dow < 1 || dow > 7 || hour < 0 || hour > 23) continue;
    heatCounts[dow - 1][hour] = count;
  }
  const maxCount = heatCounts.reduce((max, row) => Math.max(max, ...row), 0);
  return heatCounts.map((row) =>
    row.map((value) => (maxCount > 0 ? Math.round((value / maxCount) * 100) : 0))
  );
}

export async function trackVisit(req, res) {
  try {
    const path = normalizePath(req.body.path || req.body.pathname);
    if (!path) {
      return res.status(400).json({ message: "Geçersiz path" });
    }

    if (path.startsWith("/api") || path.startsWith("/admin")) {
      return res.json({ ok: true, skipped: true });
    }

    const sessionId = normalizeSessionId(req.body.sessionId);
    if (!sessionId) {
      return res.status(400).json({ message: "Geçersiz oturum anahtarı" });
    }

    const now = Date.now();
    const duplicateWindowStart = new Date(now - 4000);
    const duplicateExists = await VisitEvent.exists({
      sessionId,
      path,
      createdAt: { $gte: duplicateWindowStart },
    });
    if (duplicateExists) {
      return res.json({ ok: true, deduped: true });
    }

    const referrer = String(req.body.referrer || req.headers.referer || "")
      .trim()
      .slice(0, 600);
    const source = deriveSource(req.body.source, referrer, req.headers.host);
    const userAgent = String(req.headers["user-agent"] || "").slice(0, 600);
    const device = detectDevice(userAgent);
    const country = parseCountry(
      req.headers["x-vercel-ip-country"] ||
        req.headers["cf-ipcountry"] ||
        req.headers["cloudfront-viewer-country"] ||
        req.body.country
    );
    const query = String(req.body.query || "").slice(0, 400);
    const host = String(req.headers.host || "").slice(0, 160);
    const ip = String(req.ip || "").slice(0, 80);

    await VisitEvent.create({
      sessionId,
      path,
      query,
      referrer,
      source,
      device,
      country,
      ip,
      host,
      userAgent,
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Ziyaret kaydı alınamadı",
    });
  }
}

export async function getAdminVisitAnalyticsOverview(req, res) {
  try {
    const days = clampDays(req.query.days);
    const { start, today, buckets } = createDayBuckets(days);
    const previousStart = new Date(start.getTime() - days * DAY_MS);
    const previousEnd = new Date(start.getTime());
    const last7Start = new Date(today.getTime() - 6 * DAY_MS);

    const currentRange = { createdAt: { $gte: start } };
    const previousRange = { createdAt: { $gte: previousStart, $lt: previousEnd } };

    const [
      totalVisits,
      uniqueVisitorIds,
      previousVisits,
      previousUniqueVisitorIds,
      visitsDailyRows,
      uniqueDailyRows,
      sourceRows,
      deviceRows,
      heatRows,
      countryRows,
      topPageRows,
    ] = await Promise.all([
      VisitEvent.countDocuments(currentRange),
      VisitEvent.distinct("sessionId", currentRange),
      VisitEvent.countDocuments(previousRange),
      VisitEvent.distinct("sessionId", previousRange),
      VisitEvent.aggregate([
        { $match: currentRange },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            visits: { $sum: 1 },
          },
        },
      ]),
      VisitEvent.aggregate([
        { $match: currentRange },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              sessionId: "$sessionId",
            },
          },
        },
        {
          $group: {
            _id: "$_id.day",
            uniqueVisitors: { $sum: 1 },
          },
        },
      ]),
      VisitEvent.aggregate([
        { $match: currentRange },
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
      VisitEvent.aggregate([
        { $match: currentRange },
        { $group: { _id: "$device", count: { $sum: 1 } } },
      ]),
      VisitEvent.aggregate([
        { $match: { createdAt: { $gte: last7Start } } },
        {
          $project: {
            dow: { $isoDayOfWeek: "$createdAt" },
            hour: { $hour: "$createdAt" },
          },
        },
        {
          $group: {
            _id: { dow: "$dow", hour: "$hour" },
            count: { $sum: 1 },
          },
        },
      ]),
      VisitEvent.aggregate([
        { $match: currentRange },
        { $match: { country: { $ne: "" } } },
        { $group: { _id: "$country", visitors: { $sum: 1 } } },
        { $sort: { visitors: -1 } },
        { $limit: 10 },
      ]),
      VisitEvent.aggregate([
        { $match: currentRange },
        { $group: { _id: "$path", visits: { $sum: 1 } } },
        { $sort: { visits: -1 } },
        { $limit: 8 },
      ]),
    ]);

    const uniqueVisitors = uniqueVisitorIds.length;
    const previousUniqueVisitors = previousUniqueVisitorIds.length;
    const avgVisitsPerVisitor = uniqueVisitors
      ? round2(totalVisits / uniqueVisitors)
      : 0;
    const previousAvgVisitsPerVisitor = previousUniqueVisitors
      ? round2(previousVisits / previousUniqueVisitors)
      : 0;
    const avgDailyVisits = round2(totalVisits / days);
    const previousAvgDailyVisits = round2(previousVisits / days);

    const visitsByDay = new Map(
      visitsDailyRows.map((row) => [row._id, Number(row.visits || 0)])
    );
    const uniquesByDay = new Map(
      uniqueDailyRows.map((row) => [row._id, Number(row.uniqueVisitors || 0)])
    );
    const trend = buckets.map((bucket) => ({
      day: bucket.label,
      visits: visitsByDay.get(bucket.key) || 0,
      uniqueVisitors: uniquesByDay.get(bucket.key) || 0,
    }));

    const sourceCountMap = new Map(
      sourceRows.map((row) => [String(row._id || "other"), Number(row.count || 0)])
    );
    const trafficSources = percentRows(
      SOURCE_ORDER.map((source) => ({
        key: SOURCE_LABELS[source],
        count: sourceCountMap.get(source) || 0,
        color: SOURCE_COLORS[source],
      }))
    );

    const deviceCountMap = new Map(
      deviceRows.map((row) => [String(row._id || "desktop"), Number(row.count || 0)])
    );
    const devices = percentRows(
      DEVICE_ORDER.map((device) => ({
        key: DEVICE_LABELS[device],
        count: deviceCountMap.get(device) || 0,
        color: DEVICE_COLORS[device],
      }))
    );

    const heatmap = buildHeatmapFromRows(heatRows);

    const countries = countryRows.map((row) => ({
      country: parseCountry(row._id),
      visitors: Number(row.visitors || 0),
    }));

    const topPages = topPageRows.map((row) => ({
      path: String(row._id || "/"),
      visits: Number(row.visits || 0),
    }));

    const visitDelta = calculatePercentDelta(totalVisits, previousVisits);
    const uniqueDelta = calculatePercentDelta(uniqueVisitors, previousUniqueVisitors);
    const avgDailyDelta = calculatePercentDelta(avgDailyVisits, previousAvgDailyVisits);
    const depthDelta = calculatePercentDelta(
      avgVisitsPerVisitor,
      previousAvgVisitsPerVisitor
    );

    return res.json({
      periodDays: days,
      summary: {
        totalVisits,
        uniqueVisitors,
        avgVisitsPerVisitor,
        avgDailyVisits,
        deltas: {
          visits: formatDelta(visitDelta),
          uniqueVisitors: formatDelta(uniqueDelta),
          avgDailyVisits: formatDelta(avgDailyDelta),
          avgVisitsPerVisitor: formatDelta(depthDelta),
        },
      },
      trend,
      trafficSources,
      devices,
      heatmap,
      countries,
      topPages,
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Ziyaret analitik verisi alınamadı",
    });
  }
}

export async function getAdminAnalyticsOverview(req, res) {
  try {
    const days = clampDays(req.query.days);
    const { start, today, buckets } = createDayBuckets(days);

    const previousStart = new Date(start.getTime() - days * DAY_MS);
    const previousEnd = new Date(start.getTime());
    const last7Start = new Date(today.getTime() - 6 * DAY_MS);

    const [
      orderSummaryRows,
      previousOrderSummaryRows,
      statusRows,
      previousStatusRows,
      orderDailyRows,
      userDailyRows,
      paymentRows,
      heatRows,
      countryRows,
      previousUsers,
    ] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: { $ifNull: ["$total", 0] } },
            avgOrderValue: { $avg: { $ifNull: ["$total", 0] } },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: previousStart, $lt: previousEnd } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: { $ifNull: ["$total", 0] } },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: previousStart, $lt: previousEnd } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            orders: { $sum: 1 },
            revenue: { $sum: { $ifNull: ["$total", 0] } },
          },
        },
      ]),
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: start },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            newUsers: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $project: {
            method: { $ifNull: ["$payment.method", "other"] },
          },
        },
        { $group: { _id: "$method", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: last7Start } } },
        {
          $project: {
            dow: { $isoDayOfWeek: "$createdAt" },
            hour: { $hour: "$createdAt" },
          },
        },
        {
          $group: {
            _id: { dow: "$dow", hour: "$hour" },
            count: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $project: {
            country: { $ifNull: ["$address.country", ""] },
          },
        },
        {
          $project: {
            country: {
              $trim: {
                input: "$country",
              },
            },
          },
        },
        { $match: { country: { $ne: "" } } },
        { $group: { _id: "$country", visitors: { $sum: 1 } } },
        { $sort: { visitors: -1 } },
        { $limit: 10 },
      ]),
      User.countDocuments({
        createdAt: { $gte: previousStart, $lt: previousEnd },
        isDeleted: { $ne: true },
      }),
    ]);

    const orderSummary = orderSummaryRows[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
    };
    const previousOrderSummary = previousOrderSummaryRows[0] || {
      totalOrders: 0,
      totalRevenue: 0,
    };

    const totalOrders = Number(orderSummary.totalOrders || 0);
    const totalRevenue = round2(orderSummary.totalRevenue || 0);
    const avgOrderValue = round2(orderSummary.avgOrderValue || 0);

    const statusCountMap = new Map(
      statusRows.map((row) => [String(row._id || ""), Number(row.count || 0)])
    );
    const cancelledOrders = statusCountMap.get("cancelled") || 0;
    const cancelRate = totalOrders
      ? Math.round((cancelledOrders / totalOrders) * 100)
      : 0;

    const previousOrders = Number(previousOrderSummary.totalOrders || 0);
    const previousRevenue = Number(previousOrderSummary.totalRevenue || 0);
    const previousCancelledOrders =
      previousStatusRows.find((row) => row._id === "cancelled")?.count || 0;
    const previousCancelRate = previousOrders
      ? Math.round((previousCancelledOrders / previousOrders) * 100)
      : 0;
    const totalNewUsers = userDailyRows.reduce(
      (sum, row) => sum + Number(row.newUsers || 0),
      0
    );

    const trendMapOrders = new Map(
      orderDailyRows.map((row) => [
        row._id,
        {
          orders: Number(row.orders || 0),
          revenue: round2(row.revenue || 0),
        },
      ])
    );
    const trendMapUsers = new Map(
      userDailyRows.map((row) => [row._id, Number(row.newUsers || 0)])
    );

    const trend = buckets.map((bucket) => {
      const orderItem = trendMapOrders.get(bucket.key) || { orders: 0, revenue: 0 };
      const newUsers = trendMapUsers.get(bucket.key) || 0;
      return {
        day: bucket.label,
        orders: orderItem.orders,
        newUsers,
        revenue: orderItem.revenue,
      };
    });

    const paymentGroupMap = new Map();
    for (const row of paymentRows) {
      const key = normalizePaymentMethod(row._id);
      paymentGroupMap.set(
        key,
        (paymentGroupMap.get(key) || 0) + Number(row.count || 0)
      );
    }
    const paymentMethods = percentRows(
      ["Kapıda Ödeme", "PayPal", "Kredi Kartı", "Banka Havalesi", "Diğer"].map(
        (key) => ({
          key,
          count: paymentGroupMap.get(key) || 0,
          color: PAYMENT_COLORS[key],
        })
      )
    );

    const statusShare = percentRows(
      STATUS_ORDER.map((statusKey) => ({
        key: STATUS_LABELS[statusKey],
        count: statusCountMap.get(statusKey) || 0,
        color: STATUS_COLORS[statusKey],
      }))
    );

    const heatmap = buildHeatmapFromRows(heatRows);

    const countries = countryRows.map((row) => ({
      country: parseCountry(row._id),
      visitors: Number(row.visitors || 0),
    }));

    const paidOrLater =
      (statusCountMap.get("paid") || 0) +
      (statusCountMap.get("shipped") || 0) +
      (statusCountMap.get("completed") || 0);
    const shippedOrLater =
      (statusCountMap.get("shipped") || 0) +
      (statusCountMap.get("completed") || 0);
    const completed = statusCountMap.get("completed") || 0;

    const funnel = [
      { name: "Alınan Siparişler", value: totalOrders },
      { name: "Ödemesi Tamamlanan", value: paidOrLater },
      { name: "Kargolanan", value: shippedOrLater },
      { name: "Tamamlanan", value: completed },
    ];

    const orderDelta = calculatePercentDelta(totalOrders, previousOrders);
    const userDelta = calculatePercentDelta(totalNewUsers, previousUsers);
    const revenueDelta = calculatePercentDelta(totalRevenue, previousRevenue);
    const previousAvgOrderValue = previousOrders
      ? previousRevenue / previousOrders
      : 0;
    const avgOrderValueDelta = calculatePercentDelta(
      avgOrderValue,
      previousAvgOrderValue
    );
    const cancelRateDelta = cancelRate - previousCancelRate;

    return res.json({
      periodDays: days,
      summary: {
        totalOrders,
        totalRevenue,
        avgOrderValue,
        totalNewUsers,
        cancelRate,
        deltas: {
          orders: formatDelta(orderDelta),
          users: formatDelta(userDelta),
          revenue: formatDelta(revenueDelta),
          avgOrderValue: formatDelta(avgOrderValueDelta),
          cancelRate: `${cancelRateDelta > 0 ? "+" : ""}${cancelRateDelta}%`,
          cancelRateIsPositive: cancelRateDelta <= 0,
        },
      },
      trend,
      paymentMethods,
      statusShare,
      heatmap,
      countries,
      funnel,
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Analitik verisi alınamadı",
    });
  }
}
