import { describe, expect, it } from "vitest";

import { validateCombinedTrackedStock } from "./orderController.js";

describe("validateCombinedTrackedStock", () => {
  it("accepts stock that is already reserved for the active payment session", async () => {
    const productId = "6617f5b8f31ad8a471111111";
    const variantKey = "||||";
    const productMap = new Map([
      [
        productId,
        {
          _id: productId,
          inventory: [
            {
              color: null,
              size: null,
              attributeValue: null,
              qtyOnHand: 0,
              stockCatalog: 0,
            },
          ],
        },
      ],
    ]);
    const productStockMap = new Map([
      [
        productId,
        {
          itemMap: new Map([[variantKey, { qtyOnHand: 0 }]]),
        },
      ],
    ]);
    const catalogNeedMap = new Map([
      [productId, new Map([[variantKey, { qty: 1 }]])],
    ]);

    await expect(
      validateCombinedTrackedStock({
        productMap,
        productStockMap,
        catalogNeedMap,
        setNeedMap: new Map(),
        reservedStockEntries: [
          {
            productId,
            color: null,
            size: null,
            attribute: null,
            qty: 1,
          },
        ],
      })
    ).resolves.toBeUndefined();
  });

  it("still rejects mixed direct and set demand when reservation plus live stock is insufficient", async () => {
    const productId = "6617f5b8f31ad8a471111112";
    const variantKey = "||||";
    const productMap = new Map([
      [
        productId,
        {
          _id: productId,
          inventory: [
            {
              color: null,
              size: null,
              attributeValue: null,
              qtyOnHand: 0,
              stockCatalog: 0,
            },
          ],
        },
      ],
    ]);
    const productStockMap = new Map([
      [
        productId,
        {
          itemMap: new Map([[variantKey, { qtyOnHand: 0 }]]),
        },
      ],
    ]);
    const catalogNeedMap = new Map([
      [productId, new Map([[variantKey, { qty: 1 }]])],
    ]);
    const setNeedMap = new Map([[productId, new Map([[variantKey, 1]])]]);

    await expect(
      validateCombinedTrackedStock({
        productMap,
        productStockMap,
        catalogNeedMap,
        setNeedMap,
        reservedStockEntries: [
          {
            productId,
            color: null,
            size: null,
            attribute: null,
            qty: 1,
          },
        ],
      })
    ).rejects.toMatchObject({
      message: "Ürün ve set toplamı için yeterli stok yok",
      code: "INSUFFICIENT_STOCK",
      extra: expect.objectContaining({
        needed: 2,
        available: 1,
        availableNow: 0,
        reserved: 1,
        directQty: 1,
        setQty: 1,
      }),
    });
  });
});
