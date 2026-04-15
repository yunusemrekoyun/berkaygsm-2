import crypto from "crypto";
import { logger } from "./logger.js";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured() {
  return Boolean(
    String(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim() &&
      String(process.env.TURNSTILE_SECRET_KEY || "").trim()
  );
}

export async function verifyTurnstileToken({
  token,
  remoteIp,
  expectedHostname = "",
}) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    return { success: false, "error-codes": ["missing-secret"] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        response: String(token || "").trim(),
        remoteip: remoteIp || undefined,
        idempotency_key: crypto.randomUUID(),
      }),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        "error-codes": result?.["error-codes"] || ["bad-response"],
      };
    }

    const hostname = String(result?.hostname || "").trim().toLowerCase();
    const normalizedExpected = String(expectedHostname || "")
      .trim()
      .toLowerCase();

    // Strip leading "www." before comparing so that ceplife.com and
    // www.ceplife.com are treated as the same registered domain.
    const stripWww = (h) => h.replace(/^www\./, "");
    if (
      result?.success &&
      normalizedExpected &&
      hostname &&
      stripWww(hostname) !== stripWww(normalizedExpected)
    ) {
      logger.warn(
        {
          hostname,
          expectedHostname: normalizedExpected,
        },
        "Turnstile hostname mismatch"
      );
      return {
        ...result,
        success: false,
        "error-codes": [
          ...(Array.isArray(result?.["error-codes"])
            ? result["error-codes"]
            : []),
          "hostname-mismatch",
        ],
      };
    }

    return result;
  } catch (error) {
    logger.warn(
      { err: error?.message || String(error) },
      "Turnstile verification failed"
    );
    return {
      success: false,
      "error-codes": ["internal-error"],
    };
  } finally {
    clearTimeout(timeout);
  }
}
