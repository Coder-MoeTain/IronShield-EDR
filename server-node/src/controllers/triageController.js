/**
 * Triage controller - agent triage task fetch and result submission
 */
const TriageService = require('../modules/triage/triageService');
const EndpointService = require('../services/EndpointService');

async function getPendingTasks(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });

    const tasks = await TriageService.getPendingForEndpoint(endpoint.id);
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
}

async function submitTaskResult(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });

    const task = await TriageService.getById(id);
    if (!task || task.endpoint_id !== endpoint.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (body.success !== false) {
      await TriageService.saveResult(id, body.result || body);
    } else {
      await TriageService.markFailed(id, body.message || 'Failed');
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function submitTriageResult(req, res, next) {
  try {
    const body = req.body || {};
    const requestId = body.request_id || body.triage_request_id;
    if (!requestId) return res.status(400).json({ error: 'request_id required' });

    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });

    const task = await TriageService.getById(requestId);
    if (!task || task.endpoint_id !== endpoint.id) {
      return res.status(404).json({ error: 'Triage request not found' });
    }

    if (body.success !== false) {
      await TriageService.saveResult(requestId, body.result || body);
    } else {
      await TriageService.markFailed(requestId, body.message || 'Failed');
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPendingTasks, submitTaskResult, submitTriageResult };
