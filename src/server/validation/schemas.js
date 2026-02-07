import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "owner geçerli bir ObjectId olmalı");

const optionalTrimmed = (schema) =>
  z.union([schema, z.literal(""), z.null(), z.undefined()]).transform((val) => {
    if (val === undefined || val === null) return null;
    if (typeof val === "string") {
      const trimmed = val.trim();
      return trimmed.length ? trimmed : null;
    }
    return val;
  });

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return undefined;
  })
  .optional();

const stockRowBase = {
  color: optionalTrimmed(z.string().min(1)),
  size: optionalTrimmed(z.string().min(1)),
  attributeValue: optionalTrimmed(z.string().min(1)),
  components: z
    .array(
      z.object({
        product: objectId,
        quantity: z.coerce.number().int().min(1).default(1),
        color: optionalTrimmed(z.string().min(1)),
        size: optionalTrimmed(z.string().min(1)),
        attributeValue: optionalTrimmed(z.string().min(1)),
      })
    )
    .optional(),
  qtyOnHand: z.coerce.number().int().min(0).optional(),
  sku: optionalTrimmed(z.string().max(64)),
  isActive: boolish,
  note: optionalTrimmed(z.string().max(500)),
};

export const stockUpsertSchema = z.object({
  ownerModel: z.enum(["Product", "Set"]),
  owner: objectId,
  color: stockRowBase.color,
  size: stockRowBase.size,
  attributeValue: stockRowBase.attributeValue,
  components: stockRowBase.components,
  qtyOnHand: z.coerce.number().int().min(0).optional(),
  delta: z.coerce.number().int().optional(),
  sku: stockRowBase.sku,
  isActive: stockRowBase.isActive,
  note: stockRowBase.note,
  mode: z.enum(["set", "inc"]).default("set"),
});

const stockSyncRowSchema = z.object({
  color: stockRowBase.color,
  size: stockRowBase.size,
  attributeValue: stockRowBase.attributeValue,
  components: stockRowBase.components.default([]),
  qtyOnHand: z.coerce.number().int().min(0),
  sku: stockRowBase.sku,
  isActive: stockRowBase.isActive,
  note: stockRowBase.note,
});

export const stockSyncSchema = z.object({
  ownerModel: z.enum(["Product", "Set"]),
  owner: objectId,
  rows: z
    .array(stockSyncRowSchema)
    .min(1, "Satırlar en az bir kayıt içermeli"),
});

export const stockUpdateSchema = z
  .object({
    qtyOnHand: z.coerce.number().int().min(0).optional(),
    delta: z.coerce.number().int().optional(),
    sku: stockRowBase.sku,
    isActive: boolish,
    note: stockRowBase.note,
  })
  .refine(
    (data) =>
      data.qtyOnHand !== undefined ||
      data.delta !== undefined ||
      data.sku !== undefined ||
      data.isActive !== undefined ||
      data.note !== undefined,
    "Güncellemek için en az bir alan gönderin"
  );

const orderSetSelection = z.object({
  productId: z.string().min(1, "Seçim için productId zorunlu"),
  color: optionalTrimmed(z.string().min(1)),
  size: optionalTrimmed(z.string().min(1)),
  attribute: optionalTrimmed(z.string().min(1)),
  qtyInSet: z.coerce.number().int().min(1).max(999).default(1),
});

const orderItemBase = z.object({
  id: z.string().min(1, "Öğe id zorunlu"),
  qty: z.coerce.number().int().min(1).max(999).optional(),
});

const orderProductItemSchema = orderItemBase.extend({
  kind: z.literal("product").optional(),
  variant: z
    .object({
      color: optionalTrimmed(z.string().min(1)),
      size: optionalTrimmed(z.string().min(1)),
      attribute: optionalTrimmed(z.string().min(1)),
    })
    .optional(),
});

const orderSetItemSchema = orderItemBase.extend({
  kind: z.literal("set"),
  selections: z.array(orderSetSelection).min(1, "Set seçimleri zorunlu"),
});

export const orderItemsSchema = z
  .array(
    z
      .discriminatedUnion("kind", [orderProductItemSchema, orderSetItemSchema])
      .or(orderProductItemSchema)
  )
  .min(1, "Sepet boş");
// 1) Base schema (refine eklemeden)
const orderCreateBaseSchema = z.object({
  addressId: z.string().optional(),
  addressSnapshot: z
    .object({
      fullName: z.string().optional(),
      phone: z.string().optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      district: z.string().optional(),
      postalCode: z.string().optional(),
      addressLine: z.string().optional(),
    })
    .optional(),
  items: orderItemsSchema,
  couponCode: optionalTrimmed(z.string().max(120)),
});

// 2) Esas orderCreateSchema → refine eklenmiş hali
export const orderCreateSchema = orderCreateBaseSchema.refine(
  (data) => data.addressId || data.addressSnapshot,
  "addressId veya addressSnapshot zorunlu"
);

// 3) PayPal için subset schema → pick artık burada çalışır
export const paypalCreateSchema = orderCreateBaseSchema
  .pick({
    addressId: true,
    items: true,
    couponCode: true,
  })
  .refine(
    (data) => Boolean(data.addressId),
    "PayPal için addressId zorunlu"
  );

// 4) PayPal capture için schema (BUNUN EXPORT’U ŞART)
export const paypalCaptureSchema = z.object({
  paypalOrderId: z.string().min(1, "PayPal order id zorunlu"),
  draftId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Geçersiz taslak id"),
});
