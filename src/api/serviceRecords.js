import { http, toQueryString } from "./client.js";

const isFileLike = (value) =>
  typeof File !== "undefined" &&
  (value instanceof File || value instanceof Blob);

function appendRecordFields(form, payload = {}) {
  if (payload.customerFirstName !== undefined) {
    form.append("customerFirstName", String(payload.customerFirstName || "").trim());
  }
  if (payload.customerLastName !== undefined) {
    form.append("customerLastName", String(payload.customerLastName || "").trim());
  }
  if (payload.customerPhone !== undefined) {
    form.append("customerPhone", String(payload.customerPhone || "").trim());
  }
  if (payload.operationDetails !== undefined) {
    form.append("operationDetails", String(payload.operationDetails || "").trim());
  }
  if (payload.price !== undefined) {
    form.append("price", String(payload.price));
  }
  if (payload.warrantyMonths !== undefined) {
    form.append("warrantyMonths", String(payload.warrantyMonths));
  }
  if (payload.intakeDate !== undefined) {
    form.append("intakeDate", payload.intakeDate || "");
  }
  if (payload.completionDate !== undefined) {
    form.append("completionDate", payload.completionDate || "");
  }
  if (payload.workflowStatus !== undefined) {
    form.append("workflowStatus", payload.workflowStatus || "");
  }
  if (payload.repairOutcome !== undefined) {
    form.append("repairOutcome", payload.repairOutcome || "");
  }
}

function appendImages(form, images = []) {
  const list = Array.isArray(images) ? images : [];
  list.forEach((item) => {
    if (!item) return;
    if (isFileLike(item)) {
      form.append("images", item);
      return;
    }
    if (item.file && isFileLike(item.file)) {
      form.append("images", item.file);
      return;
    }
    if (item.originalFile && isFileLike(item.originalFile)) {
      form.append("images", item.originalFile);
      return;
    }
    if (item.url && item.publicId) {
      form.append(
        "images",
        JSON.stringify({
          url: item.url,
          publicId: item.publicId,
          width: item.width,
          height: item.height,
          format: item.format,
          bytes: item.bytes,
          resourceType: item.resourceType || "image",
        })
      );
    }
  });
}

export const serviceRecordsApi = {
  async list(params = {}) {
    const query = toQueryString(params);
    const data = await http(`/service-records${query}`, { auth: true });
    return {
      records: data?.records || [],
      pagination: data?.pagination || {
        page: 1,
        limit: 20,
        total: 0,
        pages: 1,
      },
    };
  },

  async create(payload = {}) {
    const form = new FormData();
    appendRecordFields(form, payload);
    appendImages(form, payload.images || []);

    const data = await http("/service-records", {
      method: "POST",
      body: form,
      auth: true,
    });
    return data?.record || null;
  },

  async update(id, payload = {}) {
    const form = new FormData();
    appendRecordFields(form, payload);
    appendImages(form, payload.images || []);
    if (Array.isArray(payload.removeImagePublicIds)) {
      form.append("removeImagePublicIds", JSON.stringify(payload.removeImagePublicIds));
    }

    const data = await http(`/service-records/${id}`, {
      method: "PATCH",
      body: form,
      auth: true,
    });
    return data?.record || null;
  },

  async remove(id) {
    const data = await http(`/service-records/${id}`, {
      method: "DELETE",
      auth: true,
    });
    return data?.record || null;
  },

  async restore(id) {
    const data = await http(`/service-records/${id}/restore`, {
      method: "POST",
      auth: true,
    });
    return data?.record || null;
  },
};
