/**
 * Auth validation schemas
 */
const { z } = require('zod');

const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(1),
    mfa_code: z.string().regex(/^\d{6}$/).optional(),
  }),
});

const mfaCodeSchema = z.object({
  body: z.object({
    code: z.string().regex(/^\d{6}$/),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refresh_token: z.string().min(20),
  }),
});

module.exports = { loginSchema, mfaCodeSchema, refreshSchema };
