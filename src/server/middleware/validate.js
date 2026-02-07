import { ZodError } from "zod";

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body ?? {});
      req.body = parsed;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: error.issues?.[0]?.message || "Geçersiz istek içeriği",
          details: error.issues,
        });
      }
      return res.status(400).json({
        message: error.message || "Geçersiz istek içeriği",
      });
    }
  };
}
