/**
 * Parse standard API envelope { success, data, meta?, requestId? } with legacy fallback.
 */
export function parseApiResponse(json) {
  if (json && typeof json === 'object' && json.success === true && 'data' in json) {
    return {
      success: true,
      data: json.data,
      meta: json.meta,
      requestId: json.requestId,
      legacy: false,
    };
  }
  if (json && typeof json === 'object' && json.success === false && json.error) {
    return {
      success: false,
      error: json.error,
      data: undefined,
      meta: json.meta,
      requestId: json.requestId,
      legacy: false,
    };
  }
  return {
    success: true,
    data: json,
    meta: undefined,
    requestId: json?.requestId,
    legacy: true,
  };
}

export async function readApiJson(response) {
  const json = await response.json();
  return parseApiResponse(json);
}

/** Normalize list payloads (raw array or { items | tasks | endpoints }). */
export function coerceList(value, ...keys) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    for (const k of keys) {
      if (Array.isArray(value[k])) return value[k];
    }
  }
  return [];
}
