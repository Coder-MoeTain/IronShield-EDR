/**
 * XDR ingest routes for non-endpoint telemetry (Phase 3).
 * Producers authenticate with X-Ingest-Key.
 */
const express = require('express');
const router = express.Router();
const { authIngest } = require('../middleware/authIngest');
const KafkaProducer = require('../kafka/producer');

router.use(authIngest);

// Web application telemetry (from middleware or external service)
router.post('/web', async (req, res, next) => {
  try {
    const body = req.body || {};
    await KafkaProducer.publishRawWebEvent({
      received_at: new Date().toISOString(),
      source: 'web',
      ...body,
    });
    res.status(202).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Authentication logs (Windows/Linux/IdP exports normalized by producer)
router.post('/auth', async (req, res, next) => {
  try {
    const body = req.body || {};
    await KafkaProducer.publishRawAuthEvent({
      received_at: new Date().toISOString(),
      source: 'auth',
      ...body,
    });
    res.status(202).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Zeek/NetFlow (producer posts one parsed record or batch)
router.post('/zeek', async (req, res, next) => {
  try {
    const body = req.body || {};
    await KafkaProducer.publishRawZeekEvent({
      received_at: new Date().toISOString(),
      source: 'zeek',
      ...body,
    });
    res.status(202).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

