/**
 * Request validation middleware using Zod
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (!result.success) {
        const errors = result.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({ error: 'Validation failed', details: errors });
      }
      req.validated = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate };
