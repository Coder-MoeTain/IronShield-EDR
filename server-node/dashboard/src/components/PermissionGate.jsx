import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Hide or swap UI when the user lacks a permission from /api/auth/me (or JWT *).
 * Use for destructive or privileged controls; route-level protection stays on SocRouteGuard.
 *
 * @param {string} [permission] — single permission string
 * @param {string[]} [anyOf] — if set, user needs at least one of these (e.g. ['*'] for super-admin-only UI)
 */
export default function PermissionGate({ permission, anyOf, children, fallback = null }) {
  const { hasPermission } = useAuth();
  let allowed = true;
  if (anyOf?.length) {
    allowed = anyOf.some((p) => hasPermission(p));
  } else if (permission) {
    allowed = hasPermission(permission);
  }
  if (!allowed) return fallback;
  return children;
}
