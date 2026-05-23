export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      });
    }
    req.body = parsed.data;
    next();
  };
}
