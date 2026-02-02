import { ZodError } from "zod";

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body ?? {});
      req.body = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: error.issues?.[0]?.message || "Invalid request payload",
          details: error.issues,
        });
      }
      return res.status(400).json({
        message: error.message || "Invalid request payload",
      });
    }
  };
}
