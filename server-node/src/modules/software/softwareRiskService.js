/**
 * Software vulnerability risk scoring engine.
 */
const db = require('../../utils/db');
const { matchesExpression } = require('./versionMatcher');
const { normalizeName, isBrowserSoftware, isEmailClient, isPrivilegedTool } = require('./softwareNormalize');

const SEVERITY_BASE = { low: 30, medium: 50, high: 75, critical: 90 };

function riskLevelFromScore(score) {
  if (score <= 0) return 'none';
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function findMatchingVulnerabilities(software) {
  const norm = normalizeName(software.name);
  const vendorNorm = normalizeName(software.vendor || '');
  const rows = await db.query(
    `SELECT * FROM software_vulnerabilities
     WHERE normalized_name = ?
        OR ? LIKE CONCAT('%', normalized_name, '%')
        OR normalized_name LIKE CONCAT('%', ?, '%')
        OR (vendor IS NOT NULL AND vendor != '' AND ? LIKE CONCAT('%', LOWER(vendor), '%'))
     ORDER BY cvss_score DESC`,
    [norm, norm, norm, vendorNorm]
  );
  const matched = [];
  for (const vuln of rows || []) {
    const { match, needsReview } = matchesExpression(software.version, vuln.affected_version_expression);
    if (match) matched.push({ ...vuln, needs_review: needsReview });
  }
  return matched;
}

function calculateRiskScore(software, vulns, context = {}) {
  const reasons = [];
  let score = 0;
  let recommendedAction = 'none';
  let fixedVersion = null;

  const criticalVulns = vulns.filter((v) => v.severity === 'critical');
  const highVulns = vulns.filter((v) => v.severity === 'high');
  const exploitKnown = vulns.some((v) => v.exploit_known);
  const ransomwareUsed = vulns.some((v) => v.ransomware_used);

  if (!vulns.length) {
    if (context.outdated) {
      score = 20;
      reasons.push('Outdated but no known CVE');
    }
  } else {
    const top = vulns[0];
    score = SEVERITY_BASE[top.severity] || 30;
    reasons.push(`${top.severity.charAt(0).toUpperCase() + top.severity.slice(1)} CVE found`);
    if (top.fixed_version) fixedVersion = top.fixed_version;
    recommendedAction = top.severity === 'critical' || top.severity === 'high' ? 'update' : 'update';
  }

  if (exploitKnown) {
    score += 10;
    reasons.push('Known exploited vulnerability');
  }
  if (ransomwareUsed) {
    score += 10;
    reasons.push('Ransomware-associated vulnerability');
  }
  if (context.internetFacing) {
    score += 5;
    reasons.push('Internet-facing software');
  }
  if (isBrowserSoftware(software.name) || isEmailClient(software.name)) {
    score += 5;
    reasons.push('Browser or email client software');
  }
  if (isPrivilegedTool(software.name)) {
    score += 5;
    reasons.push('Privileged or remote admin tool');
  }
  if (context.unsupported) {
    score += 15;
    reasons.push('Unsupported or end-of-life software');
    recommendedAction = recommendedAction === 'none' ? 'uninstall' : recommendedAction;
  }
  if (criticalVulns.length > 1) {
    score += 10;
    reasons.push('Multiple critical CVEs');
  }
  if (context.criticalEndpoint) {
    score += 10;
    reasons.push('Installed on high-value endpoint');
  }
  if (context.blocked) {
    reasons.push('Execution blocked by policy');
    recommendedAction = 'block';
  }
  if (vulns.some((v) => v.needs_review)) {
    reasons.push('Version match needs review');
  }

  if (context.acceptedRisk) {
    reasons.push('Accepted risk (display priority reduced)');
  }

  if (context.isLatest) {
    score = 0;
    reasons.length = 0;
    reasons.push('Fixed or latest version detected');
    recommendedAction = 'none';
  }

  score = clamp(score, 0, 100);

  if (score >= 81 && recommendedAction === 'update') recommendedAction = 'update';
  if (score >= 61 && context.unsupported) recommendedAction = 'uninstall';

  return {
    risk_score: score,
    risk_level: riskLevelFromScore(score),
    reasons,
    recommended_action: recommendedAction,
    fixed_version: fixedVersion,
    vulnerability_count: vulns.length,
    critical_count: criticalVulns.length,
    high_count: highVulns.length,
    known_exploit_count: vulns.filter((v) => v.exploit_known).length,
    outdated: !!context.outdated,
    unsupported: !!context.unsupported,
    cves: vulns.map((v) => ({
      cve_id: v.cve_id,
      severity: v.severity,
      cvss_score: v.cvss_score,
      exploit_known: !!v.exploit_known,
    })),
  };
}

async function recalculateForInventory(inventoryId, tenantId) {
  const rows = await db.query(
    `SELECT esi.*, esr.accepted_risk, esr.accepted_risk_until, esr.blocked
     FROM endpoint_software_inventory esi
     LEFT JOIN endpoint_software_risk esr ON esr.software_inventory_id = esi.id
     WHERE esi.id = ? AND esi.tenant_id = ?`,
    [inventoryId, tenantId]
  );
  const sw = rows?.[0];
  if (!sw) return null;

  const vulns = await findMatchingVulnerabilities(sw);
  const epRows = await db.query('SELECT criticality FROM endpoints WHERE id = ? LIMIT 1', [sw.endpoint_id]);
  const criticalEndpoint = epRows?.[0]?.criticality === 'high';

  const accepted =
    sw.accepted_risk &&
    (!sw.accepted_risk_until || new Date(sw.accepted_risk_until) > new Date());

  const assessment = calculateRiskScore(
    sw,
    vulns,
    {
      outdated: vulns.length > 0,
      unsupported: sw.normalized_name?.includes('java') && sw.version?.startsWith('1.'),
      internetFacing: false,
      criticalEndpoint,
      blocked: !!sw.blocked,
      acceptedRisk: accepted,
      isLatest: vulns.length === 0 && sw.version,
    }
  );

  await db.query(
    `INSERT INTO endpoint_software_risk (
      tenant_id, endpoint_id, software_inventory_id, risk_score, risk_level,
      vulnerability_count, critical_count, high_count, known_exploit_count,
      outdated, unsupported, blocked, accepted_risk, recommended_action, reason,
      risk_factors_json, calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      risk_score = VALUES(risk_score),
      risk_level = VALUES(risk_level),
      vulnerability_count = VALUES(vulnerability_count),
      critical_count = VALUES(critical_count),
      high_count = VALUES(high_count),
      known_exploit_count = VALUES(known_exploit_count),
      outdated = VALUES(outdated),
      unsupported = VALUES(unsupported),
      blocked = VALUES(blocked),
      accepted_risk = VALUES(accepted_risk),
      recommended_action = VALUES(recommended_action),
      reason = VALUES(reason),
      risk_factors_json = VALUES(risk_factors_json),
      calculated_at = NOW()`,
    [
      tenantId,
      sw.endpoint_id,
      inventoryId,
      assessment.risk_score,
      assessment.risk_level,
      assessment.vulnerability_count,
      assessment.critical_count,
      assessment.high_count,
      assessment.known_exploit_count,
      assessment.outdated ? 1 : 0,
      assessment.unsupported ? 1 : 0,
      sw.blocked ? 1 : 0,
      accepted ? 1 : 0,
      assessment.recommended_action,
      assessment.reasons.join('; '),
      JSON.stringify(assessment),
    ]
  );

  return assessment;
}

module.exports = {
  calculateRiskScore,
  findMatchingVulnerabilities,
  recalculateForInventory,
  riskLevelFromScore,
};
