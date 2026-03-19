import { describe, expect, it } from "vitest";
import { buildPrintJobSnapshot } from "./printJobService.js";

describe("buildPrintJobSnapshot", () => {
  it("includes coupon and pricing breakdown for print agents", () => {
    const snapshot = buildPrintJobSnapshot({
      orderNumber: "AYY-20260319-ABCD",
      createdAt: "2026-03-19T10:00:00.000Z",
      address: {
        fullName: "Test Kullanici",
      },
      items: [],
      subtotal: 170,
      shipping: 30,
      total: 180,
      coupon: {
        code: "WELCOME10",
        percentage: 10,
        discountAmount: 20,
      },
      pricing: {
        baseSubtotal: 200,
        standardDiscountAmount: 10,
        stackedDiscountAmount: 20,
        couponDiscountAmount: 20,
        stacked: {
          percentage: 10,
          quantity: 3,
        },
      },
    });

    expect(snapshot.coupon).toEqual({
      code: "WELCOME10",
      percentage: 10,
      discountAmount: 20,
    });
    expect(snapshot.pricing).toEqual({
      baseSubtotal: 200,
      standardDiscountAmount: 10,
      stackedDiscountAmount: 20,
      couponDiscountAmount: 20,
      stacked: {
        percentage: 10,
        quantity: 3,
      },
    });
  });
});
