import { NextResponse } from "next/server";
import { findRoute } from "./apiRoutes.js";
import { runHandlers } from "./adapter.js";
import { generalLimiter } from "./rateLimiters.js";
import { connectDB } from "../../backend/config/db.js";

export async function handleApi(request, context = {}) {
  const pathSegments = Array.isArray(context?.params?.path)
    ? context.params.path
    : [];

  const match = findRoute(request.method, pathSegments);
  if (!match) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  await connectDB();

  const handlers = [generalLimiter, ...match.handlers];

  return runHandlers(request, {
    params: match.params,
    handlers,
    bodyType: match.options?.body || "auto",
    upload: match.options?.upload || null,
  });
}
