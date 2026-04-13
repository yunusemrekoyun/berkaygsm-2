import { describe, expect, it } from "vitest";
import { buildPrintJobSnapshot, canOrderCreatePrintJob } from "./printJobService.js";

describe("buildPrintJobSnapshot", () => {
  it("includes coupon and pricing breakdown for print agents", async () => {
    const snapshot = await buildPrintJobSnapshot({
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

  it("includes member user data in the print snapshot when the order is account-based", async () => {
    const snapshot = await buildPrintJobSnapshot({
      orderNumber: "AYY-20260411-USER1",
      createdAt: "2026-04-11T11:00:00.000Z",
      user: {
        _id: "6617f5b8f31ad8a471111111",
        firstName: "Berkay",
        lastName: "Yilmaz",
        email: "berkay@example.com",
        phone: "05553334455",
      },
      address: {
        fullName: "Berkay Yilmaz",
        phone: "05553334455",
        country: "Turkiye",
        city: "Bursa",
        district: "Nilufer",
        postalCode: "16000",
        addressLine: "Ihsaniye Mahallesi",
      },
      items: [],
      subtotal: 100,
      shipping: 0,
      total: 100,
    });

    expect(snapshot.customerEmail).toBe("berkay@example.com");
    expect(snapshot.user).toEqual({
      id: "6617f5b8f31ad8a471111111",
      firstName: "Berkay",
      lastName: "Yilmaz",
      email: "berkay@example.com",
      phone: "05553334455",
    });
    expect(snapshot.customer).toMatchObject({
      fullName: "",
      email: "",
      phone: "",
      isGuest: false,
    });
  });

  it("keeps guest address data and mixed product/set lines in the print snapshot", async () => {
    const snapshot = await buildPrintJobSnapshot({
      orderNumber: "AYY-20260411-MIX1",
      createdAt: "2026-04-11T10:30:00.000Z",
      user: null,
      note: "Lutfen zile iki kez basin ve guvenlige birakmayin.",
      customer: {
        email: "guest@example.com",
      },
      address: {
        fullName: "Misafir Musteri",
        phone: "05551112233",
        country: "Turkiye",
        city: "Istanbul",
        district: "Umraniye",
        postalCode: "34764",
        addressLine: "Atakent Mahallesi Test Sokak No 5",
      },
      items: [
        {
          kind: "product",
          ref: "product-1",
          name: "Telefon Kilifi",
          unitPrice: 249.9,
          qty: 2,
          image: "https://cdn.example.com/product-1.jpg",
          variant: {
            color: "Siyah",
            size: "iPhone 15 Pro",
            attribute: null,
          },
        },
        {
          kind: "set",
          ref: "set-1",
          name: "Kurulum Seti",
          unitPrice: 399.9,
          qty: 1,
          image: "https://cdn.example.com/set-1.jpg",
          selections: [
            {
              productId: "sub-product-1",
              color: "Mavi",
              size: "Samsung S24",
              attribute: "Mat",
              qtyInSet: 1,
            },
            {
              productId: "sub-product-2",
              color: "Seffaf",
              size: "Samsung S24",
              attribute: null,
              qtyInSet: 2,
            },
          ],
        },
      ],
      subtotal: 899.7,
      shipping: 0,
      total: 899.7,
    });

    expect(snapshot.customerEmail).toBe("guest@example.com");
    expect(snapshot.user).toBe(null);
    expect(snapshot.customer).toMatchObject({
      email: "guest@example.com",
      isGuest: false,
    });
    expect(snapshot.address).toMatchObject({
      fullName: "Misafir Musteri",
      phone: "05551112233",
      city: "Istanbul",
      district: "Umraniye",
    });
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[0]).toMatchObject({
      kind: "product",
      name: "Telefon Kilifi",
      qty: 2,
      variant: {
        color: "Siyah",
        size: "iPhone 15 Pro",
        attribute: null,
      },
    });
    expect(snapshot.items[1]).toMatchObject({
      kind: "set",
      name: "Kurulum Seti",
      qty: 1,
    });
    expect(snapshot.items[1].selections).toEqual([
      {
        productId: "sub-product-1",
        productName: "",
        color: "Mavi",
        size: "Samsung S24",
        attribute: "Mat",
        qtyInSet: 1,
      },
      {
        productId: "sub-product-2",
        productName: "",
        color: "Seffaf",
        size: "Samsung S24",
        attribute: null,
        qtyInSet: 2,
      },
    ]);
  });

  it("captures payment, item pricing and stock accounting details", async () => {
    const snapshot = await buildPrintJobSnapshot({
      orderNumber: "AYY-20260413-OPS1",
      createdAt: "2026-04-13T08:30:00.000Z",
      status: "paid",
      customer: {
        fullName: "Operasyon Test",
        email: "ops@example.com",
        phone: "05559998877",
        isGuest: true,
      },
      address: {
        fullName: "Operasyon Test",
        phone: "05559998877",
      },
      payment: {
        method: "online",
        provider: "iyzico",
        status: "success",
        paidAt: "2026-04-13T08:31:00.000Z",
        currency: "TRY",
        amount: 799.9,
        txnId: "txn-123",
      },
      items: [
        {
          kind: "product",
          ref: "product-ops-1",
          name: "Kilif",
          unitPrice: 399.95,
          originalUnitPrice: 499.95,
          qty: 2,
          pricing: {
            baseUnitPrice: 499.95,
            standard: {
              name: "Hafta Sonu",
              percentage: 10,
              amount: 50,
            },
            stacked: {
              percentage: 5,
              quantity: 2,
              amount: 25,
            },
            coupon: {
              code: "CEP10",
              percentage: 10,
              amount: 25,
            },
          },
        },
      ],
      subtotal: 799.9,
      shipping: 0,
      total: 799.9,
      accounting: {
        stockApplied: true,
        couponConsumed: true,
        accountedAt: "2026-04-13T08:31:30.000Z",
        stockUsage: [
          {
            stockItemId: "stock-1",
            productId: "product-ops-1",
            color: "Siyah",
            size: "iPhone 15",
            qty: 2,
            source: "product",
            sku: "KF-15-SYH",
            previousQtyOnHand: 12,
            remainingQtyOnHand: 10,
            productName: "Kilif",
          },
        ],
      },
    });

    expect(snapshot.status).toBe("paid");
    expect(snapshot.payment).toMatchObject({
      method: "online",
      provider: "iyzico",
      status: "success",
      txnId: "txn-123",
      amount: 799.9,
    });
    expect(snapshot.items[0]).toMatchObject({
      name: "Kilif",
      originalUnitPrice: 499.95,
      pricing: {
        baseUnitPrice: 499.95,
        standard: expect.objectContaining({ amount: 50 }),
        stacked: expect.objectContaining({ amount: 25, quantity: 2 }),
        coupon: expect.objectContaining({ code: "CEP10", amount: 25 }),
      },
    });
    expect(snapshot.accounting).toMatchObject({
      stockApplied: true,
      couponConsumed: true,
    });
    expect(snapshot.accounting.stockUsage[0]).toMatchObject({
      sku: "KF-15-SYH",
      previousQtyOnHand: 12,
      remainingQtyOnHand: 10,
      productName: "Kilif",
    });
  });

  it("creates print jobs only for paid-or-later successful orders", () => {
    expect(
      canOrderCreatePrintJob({
        status: "pending",
        payment: { status: "success" },
      })
    ).toBe(false);

    expect(
      canOrderCreatePrintJob({
        status: "paid",
        payment: { status: "success" },
      })
    ).toBe(true);

    expect(
      canOrderCreatePrintJob({
        status: "shipped",
        payment: { status: "success" },
      })
    ).toBe(true);
  });
});
