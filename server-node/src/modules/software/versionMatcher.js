/**
 * Semantic-ish version comparison for vulnerability expressions.
 * Supports: <v, <=v, >v, >=v, =v, range: >=a <b
 */

function parseVersionParts(v) {
  if (!v || typeof v !== 'string') return null;
  const cleaned = v.trim().replace(/^v/i, '');
  const parts = cleaned.split(/[.\-_+]/).map((p) => {
    const m = p.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  if (!parts.length) return null;
  while (parts.length < 4) parts.push(0);
  return parts.slice(0, 8);
}

function compareVersions(a, b) {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

function matchesExpression(installedVersion, expression) {
  if (!expression || !installedVersion) return { match: false, needsReview: true };
  const expr = String(expression).trim();
  const cmp = compareVersions(installedVersion, null);

  if (expr.startsWith('range:')) {
    const inner = expr.slice(6).trim();
    const parts = inner.split(/\s+/).filter(Boolean);
    let ok = true;
    for (const part of parts) {
      const r = matchesExpression(installedVersion, part);
      if (r.needsReview) return r;
      if (!r.match) ok = false;
    }
    return { match: ok, needsReview: false };
  }

  const opMatch = expr.match(/^(<=|>=|<|>|=)(.+)$/);
  if (!opMatch) {
    const eq = compareVersions(installedVersion, expr);
    if (eq === null) return { match: false, needsReview: true };
    return { match: eq === 0, needsReview: false };
  }

  const [, op, ver] = opMatch;
  const c = compareVersions(installedVersion, ver.trim());
  if (c === null) return { match: false, needsReview: true };

  switch (op) {
    case '<':
      return { match: c < 0, needsReview: false };
    case '<=':
      return { match: c <= 0, needsReview: false };
    case '>':
      return { match: c > 0, needsReview: false };
    case '>=':
      return { match: c >= 0, needsReview: false };
    case '=':
      return { match: c === 0, needsReview: false };
    default:
      return { match: false, needsReview: true };
  }
}

module.exports = {
  parseVersionParts,
  compareVersions,
  matchesExpression,
};
