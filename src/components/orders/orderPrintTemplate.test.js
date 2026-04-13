import { describe, expect, it } from "vitest";
import {
  buildOrderPrintHtml,
  buildOrderPrintModel,
  formatPrintableOrderNote,
  formatVariantSummary,
} from "./orderPrintTemplate.js";

describe("formatPrintableOrderNote", () => {
  it("keeps short notes as-is", () => {
    expect(formatPrintableOrderNote("Kapiyi calin")).toBe("Kapiyi calin");
  });

  it("wraps long notes into printable lines", () => {
    const note =
      "Kapida arayin ve guvenlige teslim etmeyin. Paket gelmeden once telefonla bilgi verin.";

    const printable = formatPrintableOrderNote(note, {
      maxChars: 24,
      maxLines: 3,
    });

    expect(printable.split("\n").length).toBeLessThanOrEqual(3);
    expect(printable).toContain("Kapida arayin");
  });
});

describe("buildOrderPrintModel", () => {
  it("labels size selections as model in variant summaries", () => {
    expect(
      formatVariantSummary({
        color: "Siyah",
        size: "iPhone 15 Pro Max",
      })
    ).toContain("Model: iPhone 15 Pro Max");
  });

  it("prefers guest contact fields for the customer receipt", () => {
    const model = buildOrderPrintModel({
      orderNumber: "AYY-20260413-TEST",
      createdAt: "2026-04-13T10:00:00.000Z",
      customerEmail: "misafir@example.com",
      address: {
        fullName: "Misafir Musteri",
        phone: "05550000000",
        addressLine: "Moda Caddesi No 15",
        city: "Istanbul",
        district: "Kadikoy",
        postalCode: "34710",
        country: "Turkiye",
      },
      note: "Kapiyi calin",
      shippingName: "Standart Kargo",
      total: 0,
    });

    expect(model.customerName).toBe("Misafir Musteri");
    expect(model.recipientFirstName).toBe("Misafir");
    expect(model.recipientLastName).toBe("Musteri");
    expect(model.phone).toBe("05550000000");
    expect(model.email).toBe("misafir@example.com");
    expect(model.addressText).toContain("Kadikoy");
    expect(model.referenceCode).toBe("AYY-20260413-TEST");
  });

  it("injects editable slogan and social links into the receipt model", () => {
    const model = buildOrderPrintModel(
      {
        orderNumber: "AYY-20260413-TEST2",
        createdAt: "2026-04-13T10:00:00.000Z",
        address: { fullName: "Test", phone: "0555" },
      },
      {
        customerReceiptConfig: {
          slogan: "Yeni sezon hazir",
          message: "Bizi tercih ettiginiz icin tesekkur ederiz.",
          instagramUrl: "instagram.com/test",
          tiktokUrl: "tiktok.com/@test",
        },
      }
    );

    expect(model.receiptConfig.slogan).toBe("Yeni sezon hazir");
    expect(model.receiptConfig.instagramUrl).toBe("instagram.com/test");
    expect(model.receiptConfig.tiktokUrl).toBe("tiktok.com/@test");
  });

  it("renders recipient and shipment sections in html output", () => {
    const model = buildOrderPrintModel({
      orderNumber: "AYY-20260413-TEST3",
      createdAt: "2026-04-13T10:00:00.000Z",
      customerEmail: "ornek@ceplife.com",
      address: {
        fullName: "Test Musteri",
        phone: "05550000000",
        addressLine: "Deneme Mahallesi 1",
        city: "Kutahya",
        district: "Merkez",
        postalCode: "43000",
        country: "Turkiye",
      },
      note: "Teslimatta arayin",
      shippingName: "Standart Kargo",
      total: 0,
    });

    const html = buildOrderPrintHtml(model, { autoPrint: false });

    expect(html).toContain("Takip Bilgileri");
    expect(html).toContain("Diger Secenekler");
    expect(html).toContain("Alici Bilgileri");
    expect(html).toContain("Alici Soyadi");
    expect(html).toContain("SMS Secenekleri");
    expect(html).toContain("Instagram");
    expect(html).toContain("Test");
    expect(html).toContain("Musteri");
  });

  it("renders seller receipt details for operations use", () => {
    const model = buildOrderPrintModel(
      {
        orderNumber: "AYY-20260413-OPS2",
        createdAt: "2026-04-13T10:00:00.000Z",
        status: "paid",
        customer: {
          fullName: "Satici Test",
          email: "satici@example.com",
          phone: "05550000000",
          isGuest: true,
        },
        address: {
          fullName: "Satici Test",
          phone: "05550000000",
          city: "Istanbul",
          district: "Kadikoy",
          country: "Turkiye",
        },
        payment: {
          method: "online",
          provider: "iyzico",
          status: "success",
          paidAt: "2026-04-13T10:02:00.000Z",
          txnId: "txn-ops-2",
        },
        items: [
          {
            kind: "product",
            name: "Telefon Kilifi",
            unitPrice: 299.9,
            originalUnitPrice: 349.9,
            qty: 2,
            variant: {
              color: "Siyah",
              size: "iPhone 15 Pro",
            },
            pricing: {
              standard: { amount: 40 },
              stacked: { amount: 20, quantity: 2, percentage: 5 },
              coupon: { code: "CEP10", amount: 15 },
            },
          },
        ],
        subtotal: 599.8,
        shipping: 0,
        total: 599.8,
        coupon: {
          code: "CEP10",
          percentage: 10,
          discountAmount: 15,
        },
        pricing: {
          standardDiscountAmount: 40,
          stackedDiscountAmount: 20,
          stacked: { quantity: 2, percentage: 5 },
        },
        accounting: {
          stockApplied: true,
          couponConsumed: true,
          stockUsage: [
            {
              productName: "Telefon Kilifi",
              color: "Siyah",
              size: "iPhone 15 Pro",
              qty: 2,
              remainingQtyOnHand: 8,
              previousQtyOnHand: 10,
              sku: "KLF-15P-SYH",
            },
          ],
        },
      },
      { template: "seller_receipt_100x150" }
    );

    expect(model.template).toBe("seller_receipt_100x150");

    const html = buildOrderPrintHtml(model, { autoPrint: false });

    expect(html).toContain("Satici Fisi");
    expect(html).toContain("Siparis Kalemleri");
    expect(html).toContain("Telefon Kilifi");
    expect(html).toContain("Normal indirim");
    expect(html).toContain("Katlanan indirim");
    expect(html).toContain("Stok Hareketi");
    expect(html).toContain("Kalan: 8");
    expect(html).toContain("txn-ops-2");
  });
});
