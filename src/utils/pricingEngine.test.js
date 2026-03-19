import { describe, expect, it } from "vitest";
import { calculateCartPricing } from "./pricingEngine.js";

describe("calculateCartPricing", () => {
  it("applies the highest matching stacked tier to all eligible lines", () => {
    const pricing = calculateCartPricing({
      lines: [
        { lineId: "1", kind: "product", ref: "p1", qty: 1, baseUnitPrice: 100 },
        { lineId: "2", kind: "product", ref: "p2", qty: 1, baseUnitPrice: 100 },
        { lineId: "3", kind: "product", ref: "p3", qty: 1, baseUnitPrice: 100 },
      ],
      stackedDiscount: {
        active: true,
        targets: { products: ["p1", "p2", "p3"] },
        tiers: [
          { quantity: 2, percentage: 5 },
          { quantity: 3, percentage: 10 },
          { quantity: 4, percentage: 15 },
        ],
      },
    });

    expect(pricing.stacked?.active).toBe(true);
    expect(pricing.stacked?.percentage).toBe(10);
    expect(pricing.stacked?.discountAmount).toBe(30);
    expect(pricing.subtotalBeforeCoupon).toBe(270);
    expect(pricing.stacked?.nextTier?.missingQuantity).toBe(1);
  });

  it("drops the normal discount when stacked discount does not allow combining", () => {
    const pricing = calculateCartPricing({
      lines: [
        {
          lineId: "1",
          kind: "product",
          ref: "p1",
          qty: 1,
          baseUnitPrice: 100,
          standardDiscount: {
            id: "d1",
            name: "Normal",
            percentage: 20,
            allowStackedDiscountStacking: false,
          },
        },
        { lineId: "2", kind: "product", ref: "p2", qty: 1, baseUnitPrice: 100 },
      ],
      stackedDiscount: {
        active: true,
        allowDiscountStacking: false,
        targets: { products: ["p1", "p2"] },
        tiers: [{ quantity: 2, percentage: 10 }],
      },
    });

    expect(pricing.standardDiscountAmount).toBe(0);
    expect(pricing.stackedDiscountAmount).toBe(20);
    expect(pricing.lines[0].standardDiscountRemovedBy).toBe("stacked");
    expect(pricing.subtotalBeforeCoupon).toBe(180);
  });

  it("drops the normal discount when coupon takes precedence", () => {
    const pricing = calculateCartPricing({
      lines: [
        {
          lineId: "1",
          kind: "product",
          ref: "p1",
          qty: 1,
          baseUnitPrice: 100,
          standardDiscount: {
            id: "d1",
            name: "Normal",
            percentage: 20,
            allowCouponStacking: false,
          },
        },
      ],
      coupon: {
        code: "ABC10",
        percentage: 10,
        minSubtotal: 0,
        targets: { products: ["p1"] },
      },
    });

    expect(pricing.coupon?.applicable).toBe(true);
    expect(pricing.lines[0].standardDiscountRemovedBy).toBe("coupon");
    expect(pricing.subtotalBeforeCoupon).toBe(100);
    expect(pricing.coupon?.discountAmount).toBe(10);
  });

  it("suppresses stacked discount when coupon wins the conflict", () => {
    const pricing = calculateCartPricing({
      lines: [
        { lineId: "1", kind: "product", ref: "p1", qty: 1, baseUnitPrice: 100 },
        { lineId: "2", kind: "product", ref: "p2", qty: 1, baseUnitPrice: 100 },
      ],
      stackedDiscount: {
        active: true,
        allowCouponStacking: false,
        targets: { products: ["p1", "p2"] },
        tiers: [{ quantity: 2, percentage: 10 }],
      },
      coupon: {
        code: "P1ONLY",
        percentage: 10,
        minSubtotal: 0,
        targets: { products: ["p1"] },
      },
    });

    expect(pricing.stacked?.disabledByCoupon).toBe(true);
    expect(pricing.stackedDiscountAmount).toBe(0);
    expect(pricing.coupon?.discountAmount).toBe(10);
    expect(pricing.subtotalBeforeCoupon).toBe(200);
  });

  it("restores baseline discounts when coupon no longer applies", () => {
    const pricing = calculateCartPricing({
      lines: [
        {
          lineId: "1",
          kind: "product",
          ref: "p1",
          qty: 1,
          baseUnitPrice: 100,
          standardDiscount: {
            id: "d1",
            name: "Normal",
            percentage: 20,
            allowCouponStacking: false,
          },
        },
      ],
      coupon: {
        code: "MIN150",
        percentage: 10,
        minSubtotal: 150,
        targets: { products: ["p1"] },
      },
    });

    expect(pricing.coupon?.applicable).toBe(false);
    expect(pricing.standardDiscountAmount).toBe(20);
    expect(pricing.lines[0].standardDiscountApplied).toBe(true);
    expect(pricing.subtotalBeforeCoupon).toBe(80);
  });
});

