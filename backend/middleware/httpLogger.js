import pinoHttp from "pino-http";
import { logger } from "../utils/logger.js";

export const httpLogger = pinoHttp({
  logger,
  customLogLevel(res, err) {
    if (res.statusCode >= 500 || err) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req(request) {
      return {
        method: request.method,
        url: request.url,
        id: request.id,
      };
    },
  },
});
