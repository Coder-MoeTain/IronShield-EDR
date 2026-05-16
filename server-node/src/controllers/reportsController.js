const ReportService = require('../services/ReportService');
const path = require('path');
const fs = require('fs');

async function list(req, res, next) {
  try {
    const jobs = await ReportService.listJobs(req.tenantId ?? null);
    res.json({ jobs });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { report_type, format, params } = req.body || {};
    const job = await ReportService.createJob({
      tenantId: req.tenantId ?? null,
      reportType: report_type || 'daily_soc_summary',
      format: format || 'json',
      params: params || {},
      createdBy: req.user?.username,
    });
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
}

async function download(req, res, next) {
  try {
    const db = require('../utils/db');
    const row = await db.queryOne('SELECT * FROM report_jobs WHERE id = ?', [req.params.id]);
    if (!row?.download_path || !fs.existsSync(row.download_path)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.download(path.resolve(row.download_path));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, download };
