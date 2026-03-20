/**
 * Phase 3 Admin Controller - Policies, Investigations, Triage, Process Tree, Search
 */
const PolicyService = require('../modules/policies/policyService');
const InvestigationService = require('../modules/investigations/investigationService');
const TriageService = require('../modules/triage/triageService');
const ProcessTreeService = require('../modules/investigations/processTreeService');
const SearchService = require('../modules/search/searchService');
const ProcessMonitorService = require('../modules/processMonitor/processMonitorService');

// --- Policies ---
async function listPolicies(req, res, next) {
  try {
    const policies = await PolicyService.list();
    res.json(policies);
  } catch (err) {
    next(err);
  }
}

async function createPolicy(req, res, next) {
  try {
    const id = await PolicyService.create(req.body || {});
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function updatePolicy(req, res, next) {
  try {
    await PolicyService.update(req.params.id, req.body || {});
    const policy = await PolicyService.getById(req.params.id);
    res.json(policy);
  } catch (err) {
    next(err);
  }
}

async function assignPolicy(req, res, next) {
  try {
    const { id } = req.params;
    const { policy_id } = req.body || {};
    if (!policy_id) return res.status(400).json({ error: 'policy_id required' });
    await PolicyService.assignPolicy(id, policy_id, req.user?.username || 'unknown');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// --- Investigations ---
async function listInvestigations(req, res, next) {
  try {
    const cases = await InvestigationService.list(req.query);
    res.json(cases);
  } catch (err) {
    next(err);
  }
}

async function createInvestigation(req, res, next) {
  try {
    const data = { ...(req.body || {}), created_by: req.user?.username || 'unknown' };
    const { id } = await InvestigationService.create(data);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function getInvestigation(req, res, next) {
  try {
    const c = await InvestigationService.getById(req.params.id);
    if (!c) return res.status(404).json({ error: 'Investigation not found' });
    res.json(c);
  } catch (err) {
    next(err);
  }
}

async function getInvestigationNotes(req, res, next) {
  try {
    const notes = await InvestigationService.getNotes(req.params.id);
    res.json(notes);
  } catch (err) {
    next(err);
  }
}

async function addInvestigationNote(req, res, next) {
  try {
    const { id } = req.params;
    const { note } = req.body || {};
    if (!note) return res.status(400).json({ error: 'note required' });
    await InvestigationService.addNote(id, req.user?.username || 'unknown', note);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// --- Triage ---
async function listTriage(req, res, next) {
  try {
    const items = await TriageService.list(req.query);
    res.json(items);
  } catch (err) {
    next(err);
  }
}

async function getTriageRequest(req, res, next) {
  try {
    const req_ = await TriageService.getById(req.params.id);
    if (!req_) return res.status(404).json({ error: 'Triage request not found' });
    const results = await TriageService.getResultsForRequest(req.params.id);
    res.json({ ...req_, results });
  } catch (err) {
    next(err);
  }
}

async function createTriageRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { request_type, alert_id, case_id } = req.body || {};
    const triageId = await TriageService.createRequest(
      id,
      request_type || 'full',
      req.user?.username || 'unknown',
      alert_id,
      case_id
    );
    res.status(201).json({ id: triageId });
  } catch (err) {
    next(err);
  }
}

// --- Process Tree ---
async function getProcessTree(req, res, next) {
  try {
    const { endpointId } = req.params;
    const since = req.query.since || null;
    const tree = await ProcessTreeService.buildFromEvents(endpointId, since);
    res.json(tree);
  } catch (err) {
    next(err);
  }
}

// --- Process Monitor ---
async function processMonitor(req, res, next) {
  try {
    const filters = {
      tenantId: req.tenantId,
      endpointId: req.query.endpointId,
      hostname: req.query.hostname,
      processName: req.query.processName,
      username: req.query.username,
      suspectOnly: req.query.suspectOnly === 'true' || req.query.suspectOnly === '1',
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      limit: req.query.limit,
      offset: req.query.offset,
    };
    const processes = await ProcessMonitorService.list(filters);
    const summary = await ProcessMonitorService.getSuspectSummary();
    res.json({ processes, summary });
  } catch (err) {
    next(err);
  }
}

// --- Global Search ---
async function globalSearch(req, res, next) {
  try {
    const q = req.query.q || req.query.query || '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const results = await SearchService.globalSearch(q, limit);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPolicies,
  createPolicy,
  updatePolicy,
  assignPolicy,
  listInvestigations,
  createInvestigation,
  getInvestigation,
  getInvestigationNotes,
  addInvestigationNote,
  listTriage,
  getTriageRequest,
  createTriageRequest,
  getProcessTree,
  processMonitor,
  globalSearch,
};
