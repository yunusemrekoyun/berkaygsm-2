function getIncomingAgentToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  const fallback = req.headers["x-print-agent-token"];
  return typeof fallback === "string" ? fallback.trim() : "";
}

export function requirePrintAgent(req, res, next) {
  const expectedToken = String(process.env.PRINT_AGENT_TOKEN || "").trim();
  if (!expectedToken) {
    return res.status(503).json({
      message: "Print agent token yapılandırılmamış",
    });
  }

  const incomingToken = getIncomingAgentToken(req);
  if (!incomingToken || incomingToken !== expectedToken) {
    return res.status(401).json({ message: "Print agent yetkisi başarısız" });
  }

  const headerAgentId = req.headers["x-print-agent-id"];
  req.printAgentId =
    typeof headerAgentId === "string" && headerAgentId.trim()
      ? headerAgentId.trim()
      : null;

  return next();
}
