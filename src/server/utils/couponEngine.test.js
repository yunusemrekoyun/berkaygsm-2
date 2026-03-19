import { describe, expect, it } from "vitest";
import {
  calculateEligibleSubtotal,
  isCouponEligibleOrderLine,
} from "./couponEngine.js";

describe("isCouponEligibleOrderLine", () => {
  it("treats lines without discount metadata as coupon-eligible", () => {
    expect(isCouponEligibleOrderLine({ unitPrice: 100, qty: 1 })).toBe(true);
  });

  it("blocks coupon stacking when the discount explicitly disallows it", () => {
    expect(
      isCouponEligibleOrderLine({
        unitPrice: 100,
        qty: 1,
        couponStacking: { allowCouponStacking: false },
      })
    ).toBe(false);
  });
});

describe("calculateEligibleSubtotal", () => {
  it("excludes discounted lines that cannot stack with coupons from cart-wide coupons", () => {
    const eligibleSubtotal = calculateEligibleSubtotal(
      { targets: {} },
      [
        { kind: "product", ref: "p1", unitPrice: 80, qty: 1 },
        {
          kind: "product",
          ref: "p2",
          unitPrice: 90,
          qty: 2,
          couponStacking: { allowCouponStacking: false },
        },
      ]
    );

    expect(eligibleSubtotal).toBe(80);
  });

  it("also excludes non-stackable discounted lines from targeted coupons", () => {
    const eligibleSubtotal = calculateEligibleSubtotal(
      { targets: { products: ["p1", "p2"] } },
      [
        {
          kind: "product",
          ref: "p1",
          unitPrice: 80,
          qty: 1,
          couponStacking: { allowCouponStacking: false },
        },
        { kind: "product", ref: "p2", unitPrice: 120, qty: 1 },
      ]
    );

    expect(eligibleSubtotal).toBe(120);
  });
});
