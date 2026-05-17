import { describe, it, expect } from 'vitest';
import { TAB_API_ROUTES } from './tabApiRoutes';

describe('Command Center', () => {
  it('global search uses /api/v1/admin/search/global', () => {
    const route = TAB_API_ROUTES['command-center.search'];
    expect(route.path).toBe('/api/v1/admin/search/global');
    expect(route.method).toBe('GET');
  });
});
