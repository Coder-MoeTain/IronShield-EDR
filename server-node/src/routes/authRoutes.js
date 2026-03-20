/**
 * Auth routes
 */
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { loginSchema } = require('../schemas/authSchemas');

router.post('/login', validate(loginSchema), authController.login);

module.exports = router;
