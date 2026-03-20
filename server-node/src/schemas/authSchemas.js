/**
 * Auth validation schemas
 */
const { z } = require('zod');

const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(1),
  }),
});

module.exports = { loginSchema };
