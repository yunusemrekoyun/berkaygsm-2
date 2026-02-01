import { describe, it, expect } from "vitest";
import {
  orderCreateSchema,
  stockUpsertSchema,
  stockSyncSchema,
} from "../validation/schemas.js";

describe("validation schemas", () => {
  it("rejects order payloads without address", () => {
    expect(() =>
      orderCreateSchema.parse({
        items: [{ kind: "product", id: "abc", qty: 1 }],
      })
    ).toThrow(/address/i);
  });

  it("accepts valid order payloads", () => {
    const payload = orderCreateSchema.parse({
      addressId: "shipping-addr",
      items: [{ kind: "product", id: "product-1", qty: 2 }],
    });
    expect(payload.items).toHaveLength(1);
  });

  it("rejects set items without selections", () => {
    expect(() =>
      orderCreateSchema.parse({
        addressId: "addr",
        items: [{ kind: "set", id: "set-1", qty: 1 }],
      })
    ).toThrow(/selections/i);
  });

  it("validates stock upserts", () => {
    expect(() =>
      stockUpsertSchema.parse({
        ownerModel: "Product",
        owner: "invalid",
      })
    ).toThrow(/valid ObjectId/i);

    const parsed = stockUpsertSchema.parse({
      ownerModel: "Product",
      owner: "507f191e810c19729de860ea",
      qtyOnHand: 5,
      mode: "set",
    });
    expect(parsed.ownerModel).toBe("Product");
  });

  it("requires sync rows", () => {
    expect(() =>
      stockSyncSchema.parse({
        ownerModel: "Product",
        owner: "507f191e810c19729de860ea",
        rows: [],
      })
    ).toThrow(/rows must include/);
  });
});
