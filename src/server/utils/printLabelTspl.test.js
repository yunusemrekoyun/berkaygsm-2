import { describe, expect, it } from "vitest";
import { buildOrderLabelTspl } from "./printLabelTspl.js";

describe("buildOrderLabelTspl", () => {
  it("prints detailed adjustment rows without collapsing them into a single subtotal", () => {
    const tspl = buildOrderLabelTspl({
      orderNumber: "AYY-20260319-ABCD",
      createdAt: "2026-03-19T10:00:00.000Z",
      address: {
        fullName: "Test Kullanici",
        phone: "05550000000",
        addressLine: "Test Mahallesi",
        city: "Istanbul",
      },
      items: [],
      subtotal: 170,
      shipping: 30,
      total: 180,
      coupon: {
        code: "WELCOME10",
        discountAmount: 20,
      },
      pricing: {
        baseSubtotal: 200,
        standardDiscountAmount: 10,
        stackedDiscountAmount: 20,
        stacked: {
          percentage: 10,
        },
      },
    });

    expect(tspl).toContain("Ara Toplam");
    expect(tspl).toContain("Normal Ind.");
    expect(tspl).toContain("Katlanan %10");
    expect(tspl).toContain("Kupon WELCOME10");
    expect(tspl).toContain("Genel Toplam");
  });

  it("summarizes overflowing items instead of exceeding the label height", () => {
    const tspl = buildOrderLabelTspl({
      orderNumber: "AYY-20260320-LONG",
      createdAt: "2026-03-20T10:00:00.000Z",
      address: {
        fullName: "Cok Uzun Test Kullanici Adi Soyadi",
        phone: "05550000000",
        addressLine:
          "Oldukca uzun bir adres satiri ve ekstra sokak apartman mahalle bilgisi",
        city: "Istanbul",
        district: "Kadikoy",
        postalCode: "34000",
        country: "Turkiye",
      },
      items: Array.from({ length: 9 }, (_, index) => ({
        ref: `item-${index}`,
        name: `Cok uzun isimli urun ${index + 1} modeli ve aksesuar paketi`,
        qty: 1,
        unitPrice: 100,
        variant: {
          color: "Siyah",
          size: "iPhone 15 Pro Max",
        },
      })),
      subtotal: 900,
      shipping: 0,
      total: 900,
    });

    expect(tspl).toContain("diger urun");
  });
});
