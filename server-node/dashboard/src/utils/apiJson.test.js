import { describe, it, expect } from 'vitest';
import { asJsonListWithTotal } from './apiJson';

function jsonResponse(ok, body) {
  return {
    ok,
    json: async () => body,
  };
}

describe('asJsonListWithTotal', () => {
  it('parses keyed list and total', async () => {
    const r = jsonResponse(true, { investigations: [{ id: 1 }], total: 42 });
    const out = await asJsonListWithTotal(r, 'investigations');
    expect(out.list).toEqual([{ id: 1 }]);
    expect(out.total).toBe(42);
  });

  it('falls back to bare array', async () => {
    const r = jsonResponse(true, [{ id: 2 }]);
    const out = await asJsonListWithTotal(r, 'incidents');
    expect(out.list).toEqual([{ id: 2 }]);
    expect(out.total).toBe(1);
  });

  it('returns empty on error response', async () => {
    const r = jsonResponse(false, { error: 'nope' });
    const out = await asJsonListWithTotal(r, 'incidents');
    expect(out.list).toEqual([]);
    expect(out.total).toBe(0);
  });
});
