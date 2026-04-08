import { describe, expect, it } from "vitest";
import {
  buildOrderCouponContext,
  buildOrderStockUsageEntries,
  deriveOrderAccountingState,
  shouldOrderHaveAccountingEffects,
} from "./orderAccounting.js";

describe("orderAccounting", () => {
  it("marks successful paid orders as accounted when explicit flags are absent", () => {
    const state = deriveOrderAccountingState({
      status: "paid",
      payment: { status: "success" },
      coupon: { code: "WELCOME10" },
    });

    expect(state.stockApplied).toBe(true);
    expect(state.couponConsumed).toBe(true);
  });

  it("keeps failed payments unaccounted even if the order status later changed", () => {
    const state = deriveOrderAccountingState({
      status: "paid",
      payment: { status: "failed" },
      coupon: { code: "WELCOME10" },
    });

    expect(state.stockApplied).toBe(false);
    expect(state.couponConsumed).toBe(false);
  });

  it("prefers explicit accounting flags when available", () => {
    const state = deriveOrderAccountingState({
      status: "cancelled",
      payment: { status: "failed" },
      accounting: { stockApplied: false, couponConsumed: false },
      coupon: { code: "WELCOME10" },
    });

    expect(state.stockApplied).toBe(false);
    expect(state.couponConsumed).toBe(false);
  });

  it("builds aggregated stock usage from order items", () => {
    const entries = buildOrderStockUsageEntries({
      items: [
        {
          kind: "product",
          ref: "p1",
          qty: 2,
          name: "Telefon",
          image: "/a.jpg",
          variant: { color: "Siyah", size: "128GB", attribute: null },
        },
        {
          kind: "set",
          qty: 3,
          selections: [
            {
              productId: "p2",
              color: "Beyaz",
              size: "Model A",
              attribute: null,
              qtyInSet: 2,
            },
          ],
        },
      ],
    });

    expect(entries).toEqual([
      {
        productId: "p1",
        variant: { color: "Siyah", size: "128GB", attribute: null },
        qty: 2,
        source: "product",
        productName: "Telefon",
        image: "/a.jpg",
      },
      {
        productId: "p2",
        variant: { color: "Beyaz", size: "Model A", attribute: null },
        qty: 6,
        source: "set_selection",
        productName: "",
        image: "",
      },
    ]);
  });

  it("prefers explicit stock usage snapshots when present", () => {
    const entries = buildOrderStockUsageEntries({
      accounting: {
        stockUsage: [
          {
            productId: "p1",
            color: "Siyah",
            size: "128GB",
            attribute: null,
            qty: 1,
          },
        ],
      },
      items: [
        {
          kind: "product",
          ref: "ignored",
          qty: 5,
          variant: { color: "Kirmizi", size: "256GB", attribute: null },
        },
      ],
    });

    expect(entries).toEqual([
      {
        productId: "p1",
        variant: { color: "Siyah", size: "128GB", attribute: null },
        qty: 1,
        source: "product",
        productName: "",
        image: "",
      },
    ]);
  });

  it("builds coupon context from stored order data", () => {
    expect(
      buildOrderCouponContext({
        coupon: {
          couponId: "coupon-1",
          assignmentId: "assignment-1",
          code: "WELCOME10",
          audience: "personal",
        },
      })
    ).toEqual({
      couponId: "coupon-1",
      assignmentId: "assignment-1",
      code: "WELCOME10",
      audience: "personal",
      maxUsesPerUser: 1,
    });
  });

  it("uses payment and order status to determine whether accounting should be active", () => {
    expect(
      shouldOrderHaveAccountingEffects({
        status: "paid",
        payment: { status: "success" },
      })
    ).toBe(true);
    expect(
      shouldOrderHaveAccountingEffects({
        status: "cancelled",
        payment: { status: "success" },
      })
    ).toBe(false);
  });
});
