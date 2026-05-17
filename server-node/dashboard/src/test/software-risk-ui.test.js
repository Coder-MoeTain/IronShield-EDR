import { describe, it, expect } from 'vitest';
import { parseApiResponse } from '../utils/apiEnvelope';

describe('software risk api envelope', () => {
  it('parses standard success envelope', () => {
    const { data, legacy } = parseApiResponse({ success: true, data: { inventory: [], total: 0 } });
    expect(legacy).toBe(false);
    expect(data.inventory).toEqual([]);
  });

  it('falls back to legacy shape', () => {
    const { data, legacy } = parseApiResponse({ inventory: [{ id: 1 }], total: 1 });
    expect(legacy).toBe(true);
    expect(data.inventory[0].id).toBe(1);
  });
});
