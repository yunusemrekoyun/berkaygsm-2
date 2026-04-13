import mongoose from "mongoose";
import Coupon from "../models/Coupon.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import VisitEvent from "../models/VisitEvent.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SUMMARY_DAYS = 30;
const REVENUE_DAYS = 14;
const COMPARE_DAYS = 7;

const ORDER_STATUS_LABELS = {
  pending: "Beklemede",
  paid: "Odendi",
  shipped: "Kargoda",
  completed: "Tamamlandi",
  cancelled: "Iptal",
};

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
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
    return {
      key,
      label: `${String(date.getDate()).padStart(2, "0")}/${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`,
    };
  });
  return { start, today, buckets };
}

function calculatePercentDelta(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function formatDelta(delta) {
  if (delta > 0) return `+${delta}%`;
  return `${delta}%`;
}

function buildVisitMatch(range = {}) {
  return {
    ...range,
    host: {
      $not: /^(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?$/i,
    },
  };
}

function activeCouponFilter(now = new Date()) {
  return {
    active: true,
    $and: [
      {
        $or: [{ startsAt: null }, { startsAt: { $lte: now } }],
      },
      {
        $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
      },
    ],
  };
}

function shapeRecentOrder(order) {
  const populatedUser =
    order?.user && typeof order.user === "object" ? order.user : null;
  const customerName =
    String(order?.customer?.fullName || "").trim() ||
    [populatedUser?.firstName, populatedUser?.lastName].filter(Boolean).join(" ") ||
    "-";
  return {
    id: order?._id?.toString?.() || "",
    orderNumber: order?.orderNumber || "-",
    customerName,
    total: Number(order?.total || 0) || 0,
    status: String(order?.status || "pending"),
    statusLabel:
      ORDER_STATUS_LABELS[String(order?.status || "pending").toLowerCase()] ||
      "Bilinmiyor",
    createdAt: order?.createdAt || null,
  };
}

function toObjectIdValues(ids = []) {
  return Array.from(
    new Set(
      ids
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .filter((value) => mongoose.Types.ObjectId.isValid(value))
    )
  ).map((value) => new mongoose.Types.ObjectId(value));
}

export async function getAdminDashboardOverview(req, res) {
  try {
    const now = new Date();
    const summaryRange = createDayBuckets(SUMMARY_DAYS);
    const revenueRange = createDayBuckets(REVENUE_DAYS);
    const compareRange = createDayBuckets(COMPARE_DAYS);

    const previousSummaryStart = new Date(
      summaryRange.start.getTime() - SUMMARY_DAYS * DAY_MS
    );
    const previousSummaryEnd = new Date(summaryRange.start.getTime());

    const summaryOrderMatch = { createdAt: { $gte: summaryRange.start } };
    const previousSummaryOrderMatch = {
      createdAt: { $gte: previousSummaryStart, $lt: previousSummaryEnd },
    };
    const summaryVisitMatch = buildVisitMatch({
      createdAt: { $gte: summaryRange.start },
    });
    const previousSummaryVisitMatch = buildVisitMatch({
      createdAt: { $gte: previousSummaryStart, $lt: previousSummaryEnd },
    });

    const paidStatuses = ["paid", "shipped", "completed"];

    const [
      currentOrderSummaryRows,
      previousOrderSummaryRows,
      currentVisitCount,
      previousVisitCount,
      activeProductCount,
      recentActiveProductCount,
      activeCouponCount,
      recentActiveCouponCount,
      revenueRows,
      compareOrderRows,
      compareVisitRows,
      recentOrderDocs,
      topItemRows,
    ] = await Promise.all([
      Order.aggregate([
        { $match: summaryOrderMatch },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            paidOrders: {
              $sum: {
                $cond: [{ $in: ["$status", paidStatuses] }, 1, 0],
              },
            },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $in: ["$status", paidStatuses] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: previousSummaryOrderMatch },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $in: ["$status", paidStatuses] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      VisitEvent.countDocuments(summaryVisitMatch),
      VisitEvent.countDocuments(previousSummaryVisitMatch),
      Product.countDocuments({ isActive: true, listedInCatalog: true }),
      Product.countDocuments({
        isActive: true,
        listedInCatalog: true,
        createdAt: { $gte: summaryRange.start },
      }),
      Coupon.countDocuments(activeCouponFilter(now)),
      Coupon.countDocuments({
        ...activeCouponFilter(now),
        createdAt: { $gte: summaryRange.start },
      }),
      Order.aggregate([
        { $match: { createdAt: { $gte: revenueRange.start } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ["$status", paidStatuses] },
                  { $ifNull: ["$total", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: compareRange.start } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            orders: { $sum: 1 },
          },
        },
      ]),
      VisitEvent.aggregate([
        { $match: buildVisitMatch({ createdAt: { $gte: compareRange.start } }) },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            visits: { $sum: 1 },
          },
        },
      ]),
      Order.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "firstName lastName")
        .lean(),
      Order.aggregate([
        { $match: { createdAt: { $gte: summaryRange.start }, status: { $in: paidStatuses } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: {
              kind: "$items.kind",
              ref: "$items.ref",
              name: "$items.name",
            },
            quantitySold: { $sum: { $ifNull: ["$items.qty", 0] } },
            revenue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$items.qty", 0] },
                  { $ifNull: ["$items.unitPrice", 0] },
                ],
              },
            },
          },
        },
        { $sort: { revenue: -1, quantitySold: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const currentOrderSummary = currentOrderSummaryRows[0] || {
      totalOrders: 0,
      paidOrders: 0,
      totalRevenue: 0,
    };
    const previousOrderSummary = previousOrderSummaryRows[0] || {
      totalOrders: 0,
      totalRevenue: 0,
    };

    const totalOrders = Number(currentOrderSummary.totalOrders || 0);
    const paidOrders = Number(currentOrderSummary.paidOrders || 0);
    const totalVisits = Number(currentVisitCount || 0);
    const totalRevenue = round2(currentOrderSummary.totalRevenue || 0);
    const previousOrders = Number(previousOrderSummary.totalOrders || 0);
    const previousRevenue = round2(previousOrderSummary.totalRevenue || 0);
    const previousVisits = Number(previousVisitCount || 0);

    const revenueMap = new Map(
      revenueRows.map((row) => [String(row._id || ""), round2(row.revenue || 0)])
    );
    const revenueTrend = revenueRange.buckets.map((bucket) => ({
      day: bucket.label,
      revenue: revenueMap.get(bucket.key) || 0,
    }));

    const compareOrderMap = new Map(
      compareOrderRows.map((row) => [String(row._id || ""), Number(row.orders || 0)])
    );
    const compareVisitMap = new Map(
      compareVisitRows.map((row) => [String(row._id || ""), Number(row.visits || 0)])
    );
    const visitsOrdersTrend = compareRange.buckets.map((bucket) => ({
      day: bucket.label,
      visits: compareVisitMap.get(bucket.key) || 0,
      orders: compareOrderMap.get(bucket.key) || 0,
    }));

    const topProductIds = toObjectIdValues(
      topItemRows
        .filter((row) => String(row?._id?.kind || "") === "product")
        .map((row) => row?._id?.ref)
    );
    const topProducts = topProductIds.length
      ? await Product.find({ _id: { $in: topProductIds } })
          .select("sku")
          .lean()
      : [];
    const productMetaMap = new Map(
      topProducts.map((product) => [String(product._id || ""), product])
    );
    const topRevenueTotal = topItemRows.reduce(
      (sum, row) => sum + Number(row?.revenue || 0),
      0
    );
    const topItems = topItemRows.map((row) => {
      const kind = String(row?._id?.kind || "product");
      const ref = row?._id?.ref?.toString?.() || row?._id?.ref || "";
      const meta = kind === "product" ? productMetaMap.get(String(ref)) : null;
      return {
        key: `${kind}:${ref || row?._id?.name || ""}`,
        kind,
        name: String(row?._id?.name || "").trim() || "Adsiz kalem",
        sku: meta?.sku || (kind === "set" ? "SET" : "-"),
        revenue: round2(row?.revenue || 0),
        quantitySold: Number(row?.quantitySold || 0),
        share: topRevenueTotal
          ? Math.max(
              1,
              Math.round((Number(row?.revenue || 0) / topRevenueTotal) * 100)
            )
          : 0,
      };
    });

    return res.json({
      summary: {
        totalOrders,
        totalVisits,
        activeProducts: Number(activeProductCount || 0),
        activeCoupons: Number(activeCouponCount || 0),
        totalRevenue,
        paidOrders,
        conversionRate: totalVisits ? round2((totalOrders / totalVisits) * 100) : 0,
        paidRate: totalOrders ? round2((paidOrders / totalOrders) * 100) : 0,
        deltas: {
          orders: formatDelta(calculatePercentDelta(totalOrders, previousOrders)),
          visits: formatDelta(calculatePercentDelta(totalVisits, previousVisits)),
          revenue: formatDelta(calculatePercentDelta(totalRevenue, previousRevenue)),
        },
        recentActiveProducts: Number(recentActiveProductCount || 0),
        recentActiveCoupons: Number(recentActiveCouponCount || 0),
      },
      charts: {
        revenueTrend,
        visitsOrdersTrend,
      },
      recentOrders: recentOrderDocs.map(shapeRecentOrder),
      topItems,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Dashboard ozeti alinamadi",
    });
  }
}
