import net from "net";

function normalizeIpCandidate(value = "") {
  let candidate = String(value || "").trim();
  if (!candidate) return "";

  if (candidate.includes(",")) {
    candidate = candidate
      .split(",")
      .map((part) => part.trim())
      .find(Boolean) || "";
  }

  const bracketMatch = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) {
    candidate = bracketMatch[1];
  }

  const ipv4PortMatch = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4PortMatch) {
    candidate = ipv4PortMatch[1];
  }

  if (candidate.startsWith("::ffff:")) {
    const mapped = candidate.slice(7);
    if (net.isIP(mapped)) return mapped;
  }

  return net.isIP(candidate) ? candidate : "";
}

export function shouldTrustProxyIpHeaders(env = process.env) {
  const explicit = String(env.TRUST_PROXY_IP_HEADERS || "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes", "on"].includes(explicit)) return true;
  if (["0", "false", "no", "off"].includes(explicit)) return false;

  return Boolean(
    env.VERCEL ||
      env.VERCEL_ENV ||
      env.CF_PAGES ||
      env.NETLIFY
  );
}

export function getClientIp(headers = {}, options = {}) {
  const trustProxyHeaders =
    options.trustProxyHeaders ?? shouldTrustProxyIpHeaders();

  if (!trustProxyHeaders) {
    return normalizeIpCandidate(options.directIp || "");
  }

  const candidates = [
    headers["x-vercel-forwarded-for"],
    headers["x-forwarded-for"],
    headers["x-real-ip"],
    headers["cf-connecting-ip"],
    options.directIp,
  ];

  for (const raw of candidates) {
    const normalized = normalizeIpCandidate(raw);
    if (normalized) return normalized;
  }

  return "";
}
