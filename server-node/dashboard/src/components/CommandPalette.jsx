import React from 'react';
import GlobalSearch from './GlobalSearch';

/**
 * Global command palette entry — delegates to GlobalSearch (Ctrl+K).
 */
export default function CommandPalette() {
  return <GlobalSearch />;
}
