/**
 * Normalize admin API JSON for list UIs.
 * Prevents crashes when the server returns { error: '...' } on 4xx/5xx instead of an array.
 */

export async function asJsonList(response, listKey = null) {
  let data;
  try {
    data = await response.json();
  } catch {
    return [];
  }
  if (!response.ok) return [];
  if (listKey != null) {
    const v = data?.[listKey];
    return Array.isArray(v) ? v : [];
  }
  return Array.isArray(data) ? data : [];
}

export function pickSummary(data) {
  const s = data?.summary;
  if (s != null && typeof s === 'object' && !Array.isArray(s)) return s;
  return null;
}

/** Supports either a bare array or { [listKey]: array, summary?: object } */
export async function asJsonListOrKeyed(response, listKey = 'rules') {
  let data;
  try {
    data = await response.json();
  } catch {
    return { list: [], summary: null };
  }
  if (!response.ok) return { list: [], summary: null };
  if (Array.isArray(data?.[listKey])) {
    return { list: data[listKey], summary: pickSummary(data) };
  }
  if (Array.isArray(data)) {
    return { list: data, summary: null };
  }
  return { list: [], summary: null };
}
