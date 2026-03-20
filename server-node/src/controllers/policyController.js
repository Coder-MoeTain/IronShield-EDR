/**
 * Policy controller - agent policy fetch
 */
const PolicyService = require('../modules/policies/policyService');
const EndpointService = require('../services/EndpointService');

async function getPolicy(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });

    const policy = await PolicyService.getForEndpoint(endpoint.id);
    if (!policy) return res.status(404).json({ error: 'No policy assigned' });

    res.json({
      policy_id: policy.id,
      mode: policy.mode,
      telemetry_interval_seconds: policy.telemetry_interval_seconds,
      batch_upload_size: policy.batch_upload_size,
      heartbeat_interval_minutes: policy.heartbeat_interval_minutes,
      poll_interval_seconds: policy.poll_interval_seconds,
      allowed_response_actions: policy.allowed_response_actions ? JSON.parse(policy.allowed_response_actions) : [],
      allowed_triage_modules: policy.allowed_triage_modules ? JSON.parse(policy.allowed_triage_modules) : [],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPolicy };
