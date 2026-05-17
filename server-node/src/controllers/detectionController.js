/**
 * Detection engineering API controller (/api/v1/detections/*)
 */
const DetectionRuleRepository = require('../repositories/DetectionRuleRepository');
const rulePackService = require('../modules/detections/rulePackService');
const mitreCoverageService = require('../modules/detections/mitreCoverageService');
const detectionQualityService = require('../modules/detections/detectionQualityService');
const dataSourceCoverageService = require('../modules/detections/dataSourceCoverageService');
const suppressionService = require('../modules/detections/suppressionService');
const ruleReplayService = require('../modules/detections/ruleReplayService');
const ruleReviewService = require('../modules/detections/ruleReviewService');
const { runAllTests } = require('../modules/detections/ruleTester');
const { validateRules } = require('../modules/detections/ruleValidator');

function tenantId(req) {
  return req.user?.tenant_id ?? req.query.tenant_id ?? null;
}

async function listRules(req, res, next) {
  try {
    const rules = await DetectionRuleRepository.listCodeRules({
      tenant_id: tenantId(req),
      status: req.query.status,
      platform: req.query.platform,
      pack_id: req.query.pack_id,
    });
    res.json({ rules, total: rules.length });
  } catch (e) {
    next(e);
  }
}

async function getRule(req, res, next) {
  try {
    const rule = await DetectionRuleRepository.getById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    const versions = await ruleReviewService.listVersions(req.params.id);
    res.json({ rule, versions });
  } catch (e) {
    next(e);
  }
}

async function testRule(req, res, next) {
  try {
    const result = runAllTests({ rule_id: req.params.id });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

async function validateRulesHandler(req, res, next) {
  try {
    res.json(validateRules());
  } catch (e) {
    next(e);
  }
}

async function listPacks(req, res, next) {
  try {
    res.json({ packs: await rulePackService.listPacks(tenantId(req)) });
  } catch (e) {
    next(e);
  }
}

async function enablePack(req, res, next) {
  try {
    await rulePackService.setPackEnabled(req.params.id, tenantId(req), req.body.enabled !== false);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function mitreCoverage(req, res, next) {
  try {
    res.json(await mitreCoverageService.getCoverage(tenantId(req)));
  } catch (e) {
    next(e);
  }
}

async function quality(req, res, next) {
  try {
    res.json(await detectionQualityService.getRuleMetrics(tenantId(req)));
  } catch (e) {
    next(e);
  }
}

async function dataSourceCoverage(req, res, next) {
  try {
    res.json(await dataSourceCoverageService.getCoverage(tenantId(req)));
  } catch (e) {
    next(e);
  }
}

async function listSuppressions(req, res, next) {
  try {
    await suppressionService.disableExpired();
    res.json({ suppressions: await suppressionService.list(tenantId(req)) });
  } catch (e) {
    next(e);
  }
}

async function createSuppression(req, res, next) {
  try {
    const body = req.body || {};
    if (!body.expires_at) {
      return res.status(400).json({ error: 'expires_at is required for all suppressions' });
    }
    const id = await suppressionService.create(
      body,
      req.user?.username || req.user?.email,
      tenantId(req)
    );
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
}

async function deleteSuppression(req, res, next) {
  try {
    await suppressionService.remove(req.params.id, tenantId(req));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

async function startReplay(req, res, next) {
  try {
    const { report, reportPath } = await ruleReplayService.replay({
      ...req.body,
      tenant_id: req.body?.tenant_id || tenantId(req),
    });
    res.json({ report, report_path: reportPath });
  } catch (e) {
    next(e);
  }
}

async function getReplay(req, res, next) {
  try {
    const db = require('../utils/db');
    const row = await db.queryOne('SELECT * FROM detection_replay_runs WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Replay run not found' });
    res.json(row);
  } catch (e) {
    next(e);
  }
}

async function submitReview(req, res, next) {
  try {
    const rule = await DetectionRuleRepository.getById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    const result = await ruleReviewService.submitForReview(
      req.params.id,
      rule.version,
      req.user?.id
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}

async function approveRule(req, res, next) {
  try {
    const rule = await DetectionRuleRepository.getById(req.params.id);
    const authorId = req.body.author_id ?? rule?.author_id ?? rule?.author;
    const result = await ruleReviewService.approve(
      req.params.id,
      req.body.version || rule?.version,
      req.user?.id,
      req.body.comments,
      authorId
    );
    res.json(result);
  } catch (e) {
    if (e.code === 'SEPARATION_OF_DUTIES') return res.status(403).json({ error: e.message });
    next(e);
  }
}

async function rejectRule(req, res, next) {
  try {
    const result = await ruleReviewService.reject(
      req.params.id,
      req.body.version,
      req.user?.id,
      req.body.comments
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
}

async function listRuleVersions(req, res, next) {
  try {
    const versions = await ruleReviewService.listVersions(req.params.id);
    res.json({ rule_id: req.params.id, versions });
  } catch (e) {
    next(e);
  }
}

async function rollbackRule(req, res, next) {
  try {
    const { version_id: versionId } = req.body || {};
    if (!versionId) return res.status(400).json({ error: 'version_id is required' });
    const result = await ruleReviewService.rollback(
      req.params.id,
      versionId,
      req.user?.username || req.user?.email
    );
    res.json(result);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message });
    next(e);
  }
}

async function diffRule(req, res, next) {
  try {
    const fromId = req.query.from_version_id || req.query.from;
    const toId = req.query.to_version_id || req.query.to || null;
    if (!fromId) return res.status(400).json({ error: 'from_version_id query param required' });
    const result = await ruleReviewService.diffVersions(req.params.id, fromId, toId);
    res.json(result);
  } catch (e) {
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message });
    next(e);
  }
}

async function listRuleReviews(req, res, next) {
  try {
    const reviews = await ruleReviewService.listPendingReviews(tenantId(req));
    res.json({ reviews });
  } catch (e) {
    next(e);
  }
}

async function importSigma(req, res, next) {
  try {
    const { importSigmaYaml } = require('../modules/detections/sigmaImportService');
    const yamlText = req.body?.yaml || req.body?.content;
    if (!yamlText || typeof yamlText !== 'string') {
      return res.status(400).json({ error: 'yaml or content string required' });
    }
    const draft = importSigmaYaml(yamlText);
    draft.status = 'draft';
    draft.enabled = false;
    await ruleReviewService.createVersion(draft.id, draft, {
      version: draft.version,
      changed_by: req.user?.username,
      tenant_id: tenantId(req),
    });
    res.status(201).json({ rule: draft, status: 'draft', message: 'Sigma import saved as draft — submit for review before enable' });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listRules,
  getRule,
  testRule,
  validateRulesHandler,
  listPacks,
  enablePack,
  mitreCoverage,
  quality,
  dataSourceCoverage,
  listSuppressions,
  createSuppression,
  deleteSuppression,
  startReplay,
  getReplay,
  submitReview,
  approveRule,
  rejectRule,
  listRuleVersions,
  rollbackRule,
  diffRule,
  listRuleReviews,
  importSigma,
};
