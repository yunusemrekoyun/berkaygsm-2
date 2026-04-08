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
  rows: z.array(stockSyncRowSchema),
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
  note: optionalTrimmed(z.string().max(1000)),
});

export const orderCreateSchema = orderCreateBaseSchema.refine(
  (data) => data.addressId || data.addressSnapshot,
  "addressId veya addressSnapshot zorunlu"
);

export const iyzicoInitializeSchema = orderCreateBaseSchema
  .extend({
    identityNumber: optionalTrimmed(
      z
        .string()
        .trim()
        .regex(/^\d{11}$/, "TC kimlik numarası 11 haneli olmalı")
    ),
  })
  .refine(
    (data) => data.addressId || data.addressSnapshot,
    "addressId veya addressSnapshot zorunlu"
  );

export const printJobClaimSchema = z.object({
  agentId: optionalTrimmed(z.string().max(120)).optional(),
  printerName: optionalTrimmed(z.string().max(160)).optional(),
});

export const printJobCompleteSchema = z.object({
  printerName: optionalTrimmed(z.string().max(160)).optional(),
});

export const printJobFailSchema = z.object({
  printerName: optionalTrimmed(z.string().max(160)).optional(),
  error: optionalTrimmed(z.string().max(1000)),
  retryable: boolish,
});

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "Ad Soyad zorunlu").max(120),
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(160),
  phone: optionalTrimmed(
    z
      .string()
      .trim()
      .regex(/^[0-9+()\-\s]{6,32}$/, "Telefon numarası geçersiz")
  ),
  subject: z.string().trim().min(3, "Konu zorunlu").max(160),
  message: z.string().trim().min(10, "Mesaj çok kısa").max(4000),
  hp: z.string().trim().max(200).optional().default(""),
});
