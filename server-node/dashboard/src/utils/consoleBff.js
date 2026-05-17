import { apiPath } from './apiPath';
import { readApiJson } from './apiEnvelope';

/** Fetch compact console BFF payload for a module (overview, detections, protection, …). */
export async function fetchConsoleBff(api, module) {
  const res = await api(apiPath(`/api/console/${module}`));
  if (!res.ok) return null;
  const { data } = await readApiJson(res);
  return data;
}
