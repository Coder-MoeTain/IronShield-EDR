/**
 * Request validation middleware using Zod
 */
const { ERROR_CODES, sendErrorFromReq } = require('../utils/apiResponse');

function validate(schema) {
  return (req, res, next) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (!result.success) {
        const details = result.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        return sendErrorFromReq(
          res,
          req,
          ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          400,
          details
        );
      }
      req.validated = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate };
