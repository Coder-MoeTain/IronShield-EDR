/**
 * Parse standard API envelope { success, data, meta?, requestId? } with legacy fallback.
 */
export function parseApiResponse(json) {
  if (json && typeof json === 'object' && json.success === true && 'data' in json) {
    return { data: json.data, meta: json.meta, requestId: json.requestId, legacy: false };
  }
  return { data: json, meta: undefined, requestId: json?.requestId, legacy: true };
}

export async function readApiJson(response) {
  const json = await response.json();
  return parseApiResponse(json);
}
