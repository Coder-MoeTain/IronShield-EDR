import { describe, it, expect } from 'vitest';
import { falconSeverityClass, falconPaginationRangeLabel, falconCanGoNext } from './falconUi';

describe('falconSeverityClass', () => {
  it('maps severities to falcon-sev classes', () => {
    expect(falconSeverityClass('critical')).toContain('falcon-sev-critical');
    expect(falconSeverityClass('HIGH')).toContain('falcon-sev-high');
    expect(falconSeverityClass('unknown')).toContain('falcon-sev-info');
  });
});

describe('falconPaginationRangeLabel', () => {
  it('formats empty page', () => {
    expect(falconPaginationRangeLabel(0, 50, 0, 0)).toBe('0 of 0');
    expect(falconPaginationRangeLabel(0, 50, 0)).toBe('No results');
  });

  it('formats range with total', () => {
    expect(falconPaginationRangeLabel(0, 50, 25, 100)).toBe('1–25 of 100');
    expect(falconPaginationRangeLabel(50, 50, 50, 100)).toBe('51–100 of 100');
  });
});

describe('falconCanGoNext', () => {
  it('uses total when provided', () => {
    expect(falconCanGoNext(0, 50, 50, 120)).toBe(true);
    expect(falconCanGoNext(50, 50, 50, 100)).toBe(false);
  });

  it('infers from page fill when total unknown', () => {
    expect(falconCanGoNext(0, 50, 50)).toBe(true);
    expect(falconCanGoNext(0, 50, 10)).toBe(false);
  });

  it('allows next when last page is full but total unknown (investigations-style API)', () => {
    expect(falconCanGoNext(0, 50, 50, undefined)).toBe(true);
  });
});
