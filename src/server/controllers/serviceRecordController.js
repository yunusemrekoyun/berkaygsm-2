import mongoose from "mongoose";
import ServiceRecord, {
  SERVICE_OUTCOMES,
  SERVICE_WORKFLOW_STATUSES,
} from "../models/ServiceRecord.js";
import ServiceRecordCounter from "../models/ServiceRecordCounter.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import { configureCloudinary } from "../config/cloudinary.js";
import { extractAssetList } from "../utils/uploadPayload.js";

const MIN_LIMIT = 5;
const MAX_LIMIT = 100;

const WORKFLOW_SET = new Set(SERVICE_WORKFLOW_STATUSES);
const OUTCOME_SET = new Set(SERVICE_OUTCOMES);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseIntegerInRange(
  value,
  fieldName,
  { min = 0, max = 100, fallback = 0, required = false } = {}
) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${fieldName} zorunlu`);
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${fieldName} ${min}-${max} aralığında olmalı`);
  }
  return Math.floor(parsed);
}

function parseDate(value, fieldName, { required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new Error(`${fieldName} zorunlu`);
    }
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} geçersiz`);
  }
  return date;
}

function normalizeText(value, fieldName, { required = false, max = 1000 } = {}) {
  const text = String(value ?? "").trim();
  if (required && !text) {
    throw new Error(`${fieldName} zorunlu`);
  }
  if (text.length > max) {
    throw new Error(`${fieldName} en fazla ${max} karakter olabilir`);
  }
  return text;
}

function normalizeEnum(value, allowedSet, fieldName, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!allowedSet.has(normalized)) {
    throw new Error(`${fieldName} geçersiz`);
  }
  return normalized;
}

function resolveUploadFolder() {
  const instance = configureCloudinary();
  const base = (instance.uploadFolder || "berkaygsm").replace(/\/+$/, "");
  return `${base}/service-records`;
}

async function uploadImages(files = []) {
  if (!Array.isArray(files) || files.length === 0) return [];
  const folder = resolveUploadFolder();

  const uploads = files
    .filter((file) => file?.buffer && file.mimetype?.startsWith("image/"))
    .map(async (file) => {
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1400, crop: "limit", fetch_format: "auto", quality: "auto:eco" },
        ],
      });
      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        resourceType: result.resource_type || "image",
      };
    });

  return Promise.all(uploads);
}

async function nextTrackingNo() {
  const counter = await ServiceRecordCounter.findOneAndUpdate(
    { _id: "service_record" },
    { $inc: { value: 1 } },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  const current = Math.max(0, Number(counter?.value || 0));
  return `BER${String(current).padStart(5, "0")}`;
}

function addMonths(date, months) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const out = new Date(date.getTime());
  out.setMonth(out.getMonth() + Math.max(0, Number(months) || 0));
  return out;
}

function computeWarrantyInfo(completionDate, warrantyMonths) {
  if (!completionDate) {
    return {
      state: "pending",
      endsAt: null,
      daysLeft: null,
      label: "Tamir tamamlanınca hesaplanır",
    };
  }
  const months = Math.max(0, Number(warrantyMonths) || 0);
  if (months <= 0) {
    return {
      state: "no_warranty",
      endsAt: null,
      daysLeft: null,
      label: "Garanti yok",
    };
  }

  const now = new Date();
  const endsAt = addMonths(completionDate, months);
  const diffDays = Math.ceil((endsAt.getTime() - now.getTime()) / MS_PER_DAY);
  if (diffDays >= 0) {
    return {
      state: "active",
      endsAt,
      daysLeft: diffDays,
      label: `${diffDays} gün kaldı`,
    };
  }

  return {
    state: "expired",
    endsAt,
    daysLeft: diffDays,
    label: "Bitti",
  };
}

function computeDaysSinceCompletion(completionDate) {
  if (!completionDate) return null;
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - completionDate.getTime()) / MS_PER_DAY));
}

function shapeRecord(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const completionDate = plain.completionDate ? new Date(plain.completionDate) : null;
  const warranty = computeWarrantyInfo(completionDate, plain.warrantyMonths);

  return {
    id: String(plain._id),
    trackingNo: plain.trackingNo,
    customerFirstName: plain.customerFirstName,
    customerLastName: plain.customerLastName,
    customerFullName: `${plain.customerFirstName || ""} ${plain.customerLastName || ""}`.trim(),
    customerPhone: plain.customerPhone,
    operationDetails: plain.operationDetails || "",
    warrantyMonths: Number(plain.warrantyMonths || 0),
    intakeDate: plain.intakeDate || null,
    completionDate: plain.completionDate || null,
    daysSinceCompletion: computeDaysSinceCompletion(completionDate),
    warranty,
    workflowStatus: plain.workflowStatus,
    repairOutcome: plain.repairOutcome,
    images: Array.isArray(plain.images) ? plain.images : [],
    isDeleted: Boolean(plain.isDeleted),
    deletedAt: plain.deletedAt || null,
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null,
  };
}

function buildFilters(query = {}) {
  const {
    q = "",
    workflowStatus = "",
    repairOutcome = "",
    includeDeleted = "false",
    deletedOnly = "false",
    fromDate = "",
    toDate = "",
  } = query;

  const includeDeletedRows = parseBool(includeDeleted, false);
  const onlyDeletedRows = parseBool(deletedOnly, false);

  const filter = {};
  if (onlyDeletedRows) {
    filter.isDeleted = true;
  } else if (includeDeletedRows) {
    filter.isDeleted = { $in: [true, false] };
  } else {
    filter.isDeleted = false;
  }

  const search = String(q || "").trim();
  if (search) {
    filter.$or = [
      { trackingNo: { $regex: search, $options: "i" } },
      { customerFirstName: { $regex: search, $options: "i" } },
      { customerLastName: { $regex: search, $options: "i" } },
      { customerPhone: { $regex: search, $options: "i" } },
      { operationDetails: { $regex: search, $options: "i" } },
    ];
  }

  if (workflowStatus) {
    filter.workflowStatus = normalizeEnum(
      workflowStatus,
      WORKFLOW_SET,
      "workflowStatus",
      "new"
    );
  }

  if (repairOutcome) {
    filter.repairOutcome = normalizeEnum(
      repairOutcome,
      OUTCOME_SET,
      "repairOutcome",
      "ongoing"
    );
  }

  const from = fromDate ? parseDate(fromDate, "fromDate") : null;
  const to = toDate ? parseDate(toDate, "toDate") : null;
  if (from || to) {
    filter.intakeDate = {};
    if (from) filter.intakeDate.$gte = from;
    if (to) {
      const toEnd = new Date(to.getTime());
      toEnd.setHours(23, 59, 59, 999);
      filter.intakeDate.$lte = toEnd;
    }
  }

  return filter;
}

function parseRemoveIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseRemoveIds(parsed);
      } catch {
        return [];
      }
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseUpdatePayload(body = {}, existing = null) {
  const source = body && typeof body === "object" ? body : {};
  const payload = {};

  if (source.customerFirstName !== undefined) {
    payload.customerFirstName = normalizeText(
      source.customerFirstName,
      "Müşteri adı",
      { required: true, max: 80 }
    );
  }
  if (source.customerLastName !== undefined) {
    payload.customerLastName = normalizeText(
      source.customerLastName,
      "Müşteri soyadı",
      { required: true, max: 80 }
    );
  }
  if (source.customerPhone !== undefined) {
    payload.customerPhone = normalizeText(source.customerPhone, "Telefon", {
      required: true,
      max: 30,
    });
  }
  if (source.operationDetails !== undefined) {
    payload.operationDetails = normalizeText(
      source.operationDetails,
      "İşlem detayı",
      { required: true, max: 2000 }
    );
  }
  if (source.warrantyMonths !== undefined) {
    payload.warrantyMonths = parseIntegerInRange(
      source.warrantyMonths,
      "Garanti ayı",
      { min: 0, max: 120 }
    );
  }
  if (source.intakeDate !== undefined) {
    payload.intakeDate = parseDate(source.intakeDate, "Tamire alma tarihi", {
      required: true,
    });
  }
  if (source.completionDate !== undefined) {
    payload.completionDate = parseDate(source.completionDate, "Tamamlama tarihi");
  }
  if (source.workflowStatus !== undefined) {
    payload.workflowStatus = normalizeEnum(
      source.workflowStatus,
      WORKFLOW_SET,
      "Durum",
      existing?.workflowStatus || "new"
    );
  }
  if (source.repairOutcome !== undefined) {
    payload.repairOutcome = normalizeEnum(
      source.repairOutcome,
      OUTCOME_SET,
      "Sonuç",
      existing?.repairOutcome || "ongoing"
    );
  }

  return payload;
}

async function saveWithTracking(recordData, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const trackingNo = await nextTrackingNo();
      const doc = new ServiceRecord({ ...recordData, trackingNo });
      await doc.save();
      return doc;
    } catch (error) {
      const duplicateTracking =
        error?.code === 11000 && (error?.keyPattern?.trackingNo || error?.keyValue?.trackingNo);
      if (!duplicateTracking || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }
  throw new Error("Servis kayıt numarası üretilemedi");
}

export async function listServiceRecords(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "recent",
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(
      MAX_LIMIT,
      Math.max(MIN_LIMIT, Number(limit) || 20)
    );

    const filter = buildFilters(req.query);

    const sortMap = {
      recent: { createdAt: -1 },
      oldest: { createdAt: 1 },
      intake_desc: { intakeDate: -1, createdAt: -1 },
      intake_asc: { intakeDate: 1, createdAt: 1 },
      completion_desc: { completionDate: -1, createdAt: -1 },
      completion_asc: { completionDate: 1, createdAt: 1 },
    };
    const sortOption = sortMap[String(sort || "recent")] || sortMap.recent;

    const [records, total] = await Promise.all([
      ServiceRecord.find(filter)
        .sort(sortOption)
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      ServiceRecord.countDocuments(filter),
    ]);

    res.json({
      records: records.map(shapeRecord),
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Servis kayıtları alınamadı" });
  }
}

export async function createServiceRecord(req, res) {
  try {
    const {
      customerFirstName,
      customerLastName,
      customerPhone,
      operationDetails,
      warrantyMonths,
      intakeDate,
      completionDate,
      workflowStatus,
      repairOutcome,
    } = req.body || {};

    const payload = {
      customerFirstName: normalizeText(customerFirstName, "Müşteri adı", {
        required: true,
        max: 80,
      }),
      customerLastName: normalizeText(customerLastName, "Müşteri soyadı", {
        required: true,
        max: 80,
      }),
      customerPhone: normalizeText(customerPhone, "Telefon", {
        required: true,
        max: 30,
      }),
      operationDetails: normalizeText(operationDetails, "İşlem detayı", {
        required: true,
        max: 2000,
      }),
      warrantyMonths: parseIntegerInRange(warrantyMonths, "Garanti ayı", {
        min: 0,
        max: 120,
        fallback: 0,
      }),
      intakeDate: parseDate(intakeDate, "Tamire alma tarihi", { required: true }),
      completionDate: parseDate(completionDate, "Tamamlama tarihi"),
      workflowStatus: normalizeEnum(
        workflowStatus,
        WORKFLOW_SET,
        "Durum",
        "new"
      ),
      repairOutcome: normalizeEnum(
        repairOutcome,
        OUTCOME_SET,
        "Sonuç",
        "ongoing"
      ),
      createdBy: req.userId && mongoose.Types.ObjectId.isValid(req.userId)
        ? new mongoose.Types.ObjectId(req.userId)
        : null,
      updatedBy: req.userId && mongoose.Types.ObjectId.isValid(req.userId)
        ? new mongoose.Types.ObjectId(req.userId)
        : null,
    };

    if (payload.completionDate && payload.completionDate < payload.intakeDate) {
      return res.status(400).json({
        message: "Tamamlama tarihi, tamire alma tarihinden önce olamaz",
      });
    }

    const directImages = extractAssetList(req.body?.images);
    const uploadedImages = await uploadImages(Array.isArray(req.files) ? req.files : []);
    payload.images = [...directImages, ...uploadedImages].slice(0, 4);

    const created = await saveWithTracking(payload);
    res.status(201).json({ record: shapeRecord(created) });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.trackingNo) {
      return res.status(409).json({ message: "Takip numarası çakıştı, tekrar deneyin" });
    }
    res.status(400).json({ message: error.message || "Servis kaydı oluşturulamadı" });
  }
}

export async function updateServiceRecord(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Geçersiz kayıt kimliği" });
    }

    const record = await ServiceRecord.findById(id);
    if (!record) return res.status(404).json({ message: "Servis kaydı bulunamadı" });

    const payload = parseUpdatePayload(req.body, record);

    if (payload.intakeDate && payload.completionDate) {
      if (payload.completionDate.getTime() < payload.intakeDate.getTime()) {
        return res.status(400).json({ message: "Tamamlama tarihi, alma tarihinden önce olamaz" });
      }
    } else if (payload.completionDate && record.intakeDate) {
      if (payload.completionDate.getTime() < record.intakeDate.getTime()) {
        return res.status(400).json({ message: "Tamamlama tarihi, alma tarihinden önce olamaz" });
      }
    } else if (payload.intakeDate && record.completionDate) {
      if (record.completionDate.getTime() < payload.intakeDate.getTime()) {
        return res.status(400).json({ message: "Tamamlama tarihi, alma tarihinden önce olamaz" });
      }
    }

    Object.assign(record, payload);

    const removeImagePublicIds = parseRemoveIds(req.body?.removeImagePublicIds);
    if (removeImagePublicIds.length) {
      record.images = (record.images || []).filter(
        (image) => !removeImagePublicIds.includes(image.publicId)
      );
      await Promise.allSettled(
        removeImagePublicIds.map((publicId) => deleteFromCloudinary(publicId, "image"))
      );
      record.markModified("images");
    }

    const directImages = extractAssetList(req.body?.images);
    if (directImages.length) {
      record.images.push(...directImages);
      record.markModified("images");
    }

    const uploadedImages = await uploadImages(Array.isArray(req.files) ? req.files : []);
    if (uploadedImages.length) {
      record.images.push(...uploadedImages);
      record.markModified("images");
    }

    if (Array.isArray(record.images) && record.images.length > 4) {
      record.images = record.images.slice(0, 4);
      record.markModified("images");
    }

    if (req.userId && mongoose.Types.ObjectId.isValid(req.userId)) {
      record.updatedBy = new mongoose.Types.ObjectId(req.userId);
    }

    await record.save();
    res.json({ record: shapeRecord(record) });
  } catch (error) {
    res.status(400).json({ message: error.message || "Servis kaydı güncellenemedi" });
  }
}

export async function deleteServiceRecord(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Geçersiz kayıt kimliği" });
    }

    const record = await ServiceRecord.findById(id);
    if (!record) return res.status(404).json({ message: "Servis kaydı bulunamadı" });

    if (record.isDeleted) {
      return res.json({ record: shapeRecord(record) });
    }

    record.isDeleted = true;
    record.deletedAt = new Date();
    if (req.userId && mongoose.Types.ObjectId.isValid(req.userId)) {
      record.deletedBy = new mongoose.Types.ObjectId(req.userId);
      record.updatedBy = new mongoose.Types.ObjectId(req.userId);
    }
    await record.save();
    res.json({ record: shapeRecord(record) });
  } catch (error) {
    res.status(400).json({ message: error.message || "Servis kaydı silinemedi" });
  }
}

export async function restoreServiceRecord(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Geçersiz kayıt kimliği" });
    }

    const record = await ServiceRecord.findById(id);
    if (!record) return res.status(404).json({ message: "Servis kaydı bulunamadı" });

    record.isDeleted = false;
    record.deletedAt = null;
    record.deletedBy = null;
    if (req.userId && mongoose.Types.ObjectId.isValid(req.userId)) {
      record.updatedBy = new mongoose.Types.ObjectId(req.userId);
    }
    await record.save();
    res.json({ record: shapeRecord(record) });
  } catch (error) {
    res.status(400).json({ message: error.message || "Servis kaydı geri alınamadı" });
  }
}
