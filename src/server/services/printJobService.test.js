import { describe, expect, it } from "vitest";
import { buildPrintJobSnapshot, canOrderCreatePrintJob } from "./printJobService.js";

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

  it("includes member user data in the print snapshot when the order is account-based", () => {
    const snapshot = buildPrintJobSnapshot({
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

    expect(snapshot.user).toEqual({
      id: "6617f5b8f31ad8a471111111",
      firstName: "Berkay",
      lastName: "Yilmaz",
      email: "berkay@example.com",
      phone: "05553334455",
    });
  });

  it("keeps guest address data and mixed product/set lines in the print snapshot", () => {
    const snapshot = buildPrintJobSnapshot({
      orderNumber: "AYY-20260411-MIX1",
      createdAt: "2026-04-11T10:30:00.000Z",
      user: null,
      note: "Lutfen zile iki kez basin ve guvenlige birakmayin.",
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

    expect(snapshot.user).toBe(null);
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
    ]);
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
