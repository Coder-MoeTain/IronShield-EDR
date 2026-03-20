/**
 * Alert notifications - email and webhook
 */
const db = require('../utils/db');
const logger = require('../utils/logger');
const config = require('../config');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (_) {
  nodemailer = null;
}

async function getChannelsForAlert(alert, endpoint) {
  const tenantId = endpoint?.tenant_id ?? null;
  let sql = 'SELECT * FROM notification_channels WHERE is_active = 1';
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(tenantId);
  }
  return db.query(sql, params);
}

async function sendEmail(channel, alert, endpoint) {
  const cfg = channel.config || {};
  if (!nodemailer || !cfg.smtpHost) return;
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort || 587,
      secure: cfg.secure === true,
      auth: cfg.auth ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    await transporter.sendMail({
      from: cfg.from || 'edr@localhost',
      to: cfg.to || cfg.recipients,
      subject: `[EDR Alert] ${alert.severity}: ${alert.title}`,
      text: `Alert: ${alert.title}\nSeverity: ${alert.severity}\nEndpoint: ${endpoint?.hostname || 'unknown'}\n\n${alert.description || ''}`,
    });
    logger.info({ channelId: channel.id }, 'Email notification sent');
  } catch (err) {
    logger.warn({ err: err.message, channelId: channel.id }, 'Email notification failed');
  }
}

async function sendWebhook(channel, alert, endpoint) {
  const cfg = channel.config || {};
  const url = cfg.url || channel.url;
  if (!url) return;
  try {
    const body = {
      event: 'alert.created',
      alert: {
        id: alert.id,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        status: alert.status,
      },
      endpoint: endpoint ? { id: endpoint.id, hostname: endpoint.hostname } : null,
      timestamp: new Date().toISOString(),
    };
    const secret = channel.secret || cfg.secret;
    const headers = { 'Content-Type': 'application/json' };
    if (secret) {
      const crypto = require('crypto');
      const sig = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
      headers['X-EDR-Signature'] = sig;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.info({ channelId: channel.id }, 'Webhook notification sent');
  } catch (err) {
    logger.warn({ err: err.message, channelId: channel.id }, 'Webhook notification failed');
  }
}

async function notifyAlertCreated(alert, endpoint) {
  const channels = await getChannelsForAlert(alert, endpoint);
  for (const ch of channels) {
    if (ch.type === 'email') {
      await sendEmail(ch, alert, endpoint);
    } else if (ch.type === 'webhook') {
      await sendWebhook(ch, alert, endpoint);
    }
  }
  if (config.notifications?.inApp !== false) {
    try {
      await db.execute(
        `INSERT INTO notifications (user_id, tenant_id, type, title, body, link)
         VALUES (NULL, ?, 'alert', ?, ?, ?)`,
        [
          endpoint?.tenant_id ?? null,
          `[${alert.severity}] ${alert.title}`,
          alert.description || '',
          `/alerts/${alert.id}`,
        ]
      );
    } catch (_) {
      // notifications table may not exist
    }
  }
}

module.exports = { notifyAlertCreated, getChannelsForAlert };
