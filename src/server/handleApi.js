import { NextResponse } from "next/server";
import { findRoute } from "./apiRoutes.js";
import { runHandlers } from "./adapter.js";
import { generalLimiter } from "./rateLimiters.js";
import { connectDB } from "./config/db.js";

export async function handleApi(request, context = {}) {
  const paramsSource = context?.params;
  const resolvedParams =
    paramsSource && typeof paramsSource.then === "function"
      ? await paramsSource
      : paramsSource;
  const pathSegments = Array.isArray(resolvedParams?.path)
    ? resolvedParams.path
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
