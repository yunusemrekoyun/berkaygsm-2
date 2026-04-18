import { NextResponse } from "next/server";
import cookie from "cookie";
import {
  parseMultipart,
  assertUploadLimits,
  applyUploadMode,
} from "./multipart.js";
import { getClientIp } from "./utils/clientIp.js";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function buildHeaders(request) {
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return cookie.parse(header);
}

async function parseBody(request, bodyType) {
  if (!METHODS_WITH_BODY.has(request.method)) return { body: {}, filesByField: {} };

  const contentType = request.headers.get("content-type") || "";

  if (bodyType === "form") {
    if (contentType.includes("multipart/form-data")) {
      const { fields, filesByField } = await parseMultipart(request);
      return { body: fields, filesByField };
    }
    if (contentType.includes("application/json")) {
      try {
        const json = await request.json();
        return { body: json || {}, filesByField: {} };
      } catch {
        return { body: {}, filesByField: {} };
      }
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      try {
        const text = await request.text();
        const params = new URLSearchParams(text);
        const body = {};
        params.forEach((value, key) => {
          body[key] = value;
        });
        return { body, filesByField: {} };
      } catch {
        return { body: {}, filesByField: {} };
      }
    }
    return { body: {}, filesByField: {} };
  }

  if (contentType.includes("multipart/form-data")) {
    const { fields, filesByField } = await parseMultipart(request);
    return { body: fields, filesByField };
  }

  if (contentType.includes("application/json")) {
    try {
      const json = await request.json();
      return { body: json || {}, filesByField: {} };
    } catch {
      return { body: {}, filesByField: {} };
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    try {
      const text = await request.text();
      const params = new URLSearchParams(text);
      const body = {};
      params.forEach((value, key) => {
        body[key] = value;
      });
      return { body, filesByField: {} };
    } catch {
      return { body: {}, filesByField: {} };
    }
  }

  return { body: {}, filesByField: {} };
}

class ResponseMock {
  constructor() {
    this.statusCode = 200;
    this.headers = new Headers();
    this.cookies = [];
    this.body = undefined;
    this.jsonBody = undefined;
    this.sent = false;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  setHeader(key, value) {
    this.headers.set(key, value);
    return this;
  }

  set(obj = {}) {
    Object.entries(obj).forEach(([key, value]) => {
      this.headers.set(key, value);
    });
    return this;
  }

  json(payload) {
    this.jsonBody = payload;
    this.body = undefined;
    this.sent = true;
    return this;
  }

  send(payload) {
    this.body = payload;
    this.jsonBody = undefined;
    this.sent = true;
    return this;
  }

  cookie(name, value, options = {}) {
    this.cookies.push({ name, value, options });
    return this;
  }

  clearCookie(name, options = {}) {
    this.cookies.push({
      name,
      value: "",
      options: { ...options, maxAge: 0 },
    });
    return this;
  }

  toNextResponse() {
    let response;
    if (this.jsonBody !== undefined) {
      response = NextResponse.json(this.jsonBody, {
        status: this.statusCode,
        headers: this.headers,
      });
    } else if (this.body !== undefined) {
      response = new NextResponse(this.body, {
        status: this.statusCode,
        headers: this.headers,
      });
    } else {
      response = new NextResponse(null, { status: this.statusCode, headers: this.headers });
    }

    this.cookies.forEach(({ name, value, options }) => {
      const normalizedMaxAge =
        typeof options.maxAge === "number"
          ? Math.floor(options.maxAge / 1000)
          : undefined;
      response.cookies.set({
        name,
        value,
        httpOnly: options.httpOnly ?? false,
        secure: options.secure ?? false,
        sameSite: options.sameSite || "lax",
        ...(options.domain ? { domain: options.domain } : {}),
        path: options.path || "/",
        maxAge: normalizedMaxAge,
      });
    });

    return response;
  }
}

export async function runHandlers(request, { params = {}, handlers = [], bodyType = "auto", upload = null } = {}) {
  const url = new URL(request.url);
  const headers = buildHeaders(request);
  let body = {};
  let filesByField = {};
  try {
    const parsed = await parseBody(request, bodyType);
    body = parsed.body || {};
    filesByField = parsed.filesByField || {};
  } catch (error) {
    const status = error?.status || 400;
    return NextResponse.json(
      { message: error?.message || "Geçersiz istek içeriği" },
      { status }
    );
  }

  if (upload) {
    const limits = { ...(upload.limits || {}) };
    if (upload.type === "single" && limits.maxFiles == null) {
      limits.maxFiles = 1;
    }
    try {
      assertUploadLimits(filesByField, limits);
    } catch (error) {
      const status = error?.status || 400;
      return NextResponse.json(
        { message: error?.message || "Yükleme reddedildi" },
        { status }
      );
    }
  }

  const req = {
    method: request.method,
    url: request.url,
    headers,
    query: Object.fromEntries(url.searchParams.entries()),
    params: params || {},
    cookies: parseCookies(request),
    body,
    ip: getClientIp(headers),
    file: null,
    files: undefined,
  };

  if (upload) {
    applyUploadMode(req, filesByField, upload);
  }

  const res = new ResponseMock();

  let index = -1;
  const next = async (err) => {
    if (err) throw err;
    index += 1;
    const handler = handlers[index];
    if (!handler) return;
    let nextCalled = false;
    const wrappedNext = (error) => {
      nextCalled = true;
      return next(error);
    };
    await handler(req, res, wrappedNext);
    if (res.sent) return;
    if (!nextCalled && handlers[index + 1]) {
      await next();
    }
  };

  try {
    await next();
  } catch (error) {
    const status = error?.status || 500;
    return NextResponse.json(
      { message: error?.message || "Sunucu hatası" },
      { status }
    );
  }

  return res.toNextResponse();
}
