import { describe, expect, it } from "vitest";
import {
  buildOrderPrintModel,
  formatVariantSummary,
  formatPrintableOrderNote,
} from "./orderPrintTemplate.js";

describe("formatPrintableOrderNote", () => {
  it("keeps short notes as-is", () => {
    expect(formatPrintableOrderNote("Kapiyi calin")).toBe("Kapiyi calin");
  });

  it("limits long notes to a fixed printable area", () => {
    const note = [
      "Kapida arayin ve guvenlige teslim etmeyin.",
      "Paketin uzerine dikkat kirilabilir yazin.",
      "Musait olmazsam 10 dakika sonra tekrar deneyin.",
    ].join(" ");

    const printable = formatPrintableOrderNote(note, {
      maxChars: 20,
      maxLines: 2,
    });

    const lines = printable.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("...")).toBe(true);
  });
});

describe("buildOrderPrintModel", () => {
  it("labels size selections as model in the print summary", () => {
    expect(
      formatVariantSummary({
        color: "Siyah",
        size: "iPhone 15 Pro Max",
      })
    ).toContain("Model: iPhone 15 Pro Max");
  });

  it("uses the printable note in the label model", () => {
    const model = buildOrderPrintModel({
      orderNumber: "ORD-1",
      createdAt: "2026-03-19T12:00:00.000Z",
      address: {
        fullName: "Test Kullanici",
        phone: "05550000000",
        addressLine: "Test Mahallesi",
        city: "Istanbul",
        district: "Kadikoy",
        postalCode: "34000",
        country: "Turkiye",
      },
      items: [],
      subtotal: 0,
      shipping: 0,
      total: 0,
      note:
        "Bu not uzun tutuldugu icin yazdirma alanina sigacak sekilde sinirlanmalidir.",
    });

    expect(model.note).toBeTruthy();
    expect(model.note.split("\n").length).toBeLessThanOrEqual(4);
  });

  it("prefers base subtotal when discount adjustments are rendered", () => {
    const model = buildOrderPrintModel({
      subtotal: 170,
      shipping: 0,
      total: 150,
      pricing: {
        baseSubtotal: 200,
        standardDiscountAmount: 20,
        stackedDiscountAmount: 10,
      },
      coupon: {
        code: "TEST10",
        discountAmount: 20,
      },
      items: [],
      address: {},
    });

    expect(model.subtotalLabel).toBe("₺200,00");
    expect(model.adjustments).toHaveLength(3);
  });

  it("switches to a denser layout and summarizes overflow items for large orders", () => {
    const model = buildOrderPrintModel({
      orderNumber: "ORD-2",
      createdAt: "2026-03-19T12:00:00.000Z",
      address: {
        fullName: "Cok Uzun Test Kullanici Adi Soyadi",
        phone: "05550000000",
        addressLine:
          "Oldukca uzun bir adres satiri ve buna eklenen ekstra mahalle ve sokak bilgileri",
        city: "Istanbul",
        district: "Kadikoy",
        postalCode: "34000",
        country: "Turkiye",
      },
      items: Array.from({ length: 8 }, (_, index) => ({
        ref: `item-${index}`,
        name: `Cok uzun isimli urun ${index + 1} modeli ve aksesuar paketi`,
        qty: 1,
        unitPrice: 100 + index,
        variant: {
          color: "Siyah",
          size: "iPhone 15 Pro Max",
        },
      })),
      subtotal: 800,
      shipping: 0,
      total: 800,
      note:
        "Bu siparis yogun icerik testi icindir ve fisin icerisine kontrollu sekilde sigmalidir.",
    });

    expect(model.layout.key).not.toBe("regular");
    expect(model.items.some((item) => item.isOverflowSummary)).toBe(true);
  });
});
