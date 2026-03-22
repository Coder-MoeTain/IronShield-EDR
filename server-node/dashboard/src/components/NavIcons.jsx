import React from 'react';

const stroke = { stroke: 'currentColor', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

export function IconActivity(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <path {...stroke} d="M4 19V5M9 19V9M14 19v-6M19 19V8" />
    </svg>
  );
}

export function IconDetections(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <path {...stroke} d="M12 9v4M12 17h.01" />
      <path {...stroke} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h18.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

export function IconHosts(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <rect {...stroke} x="2" y="3" width="20" height="14" rx="2" />
      <path {...stroke} d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function IconNetwork(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <circle {...stroke} cx="12" cy="12" r="3" />
      <path {...stroke} d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    </svg>
  );
}

export function IconExplore(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <circle {...stroke} cx="11" cy="11" r="7" />
      <path {...stroke} d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconRules(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <path {...stroke} d="M4 6h16M4 12h10M4 18h16" />
    </svg>
  );
}

export function IconRespond(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <path {...stroke} d="M9 12l2 2 4-4M5 7V5a2 2 0 012-2h10a2 2 0 012 2v2M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2" />
    </svg>
  );
}

export function IconIntel(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <path {...stroke} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

export function IconTerminal(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <path {...stroke} d="M4 6h16M4 12h8M4 18h12" />
    </svg>
  );
}

export function IconGraph(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <circle {...stroke} cx="6" cy="6" r="2.5" />
      <circle {...stroke} cx="18" cy="8" r="2.5" />
      <circle {...stroke} cx="12" cy="18" r="2.5" />
      <path {...stroke} d="M8 7.5l4 8M14.5 9.5L16 16M8.5 7.5L15.5 8" />
    </svg>
  );
}

export function IconConfig(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <circle {...stroke} cx="12" cy="12" r="3" />
      <path {...stroke} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconEnterprise(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <path {...stroke} d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-4h6v4" />
    </svg>
  );
}

export function IconShield(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...props}>
      <path {...stroke} d="M12 3l8 4v5c0 5-3.5 9-8 11-4.5-2-8-6-8-11V7l8-4z" />
    </svg>
  );
}
