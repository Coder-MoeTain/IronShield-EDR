import { describe, it, expect } from 'vitest';
import { parseApiResponse } from './apiEnvelope';

describe('parseApiResponse', () => {
  it('parses success envelope', () => {
    const parsed = parseApiResponse({ success: true, data: { id: 1 }, requestId: 'r1' });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ id: 1 });
    expect(parsed.legacy).toBe(false);
  });

  it('parses error envelope', () => {
    const parsed = parseApiResponse({
      success: false,
      error: { code: 'NOT_FOUND', message: 'missing' },
      requestId: 'r2',
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.code).toBe('NOT_FOUND');
    expect(parsed.legacy).toBe(false);
  });

  it('treats legacy raw JSON as success data', () => {
    const parsed = parseApiResponse({ endpoint: { id: 5 } });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ endpoint: { id: 5 } });
    expect(parsed.legacy).toBe(true);
  });
});
