import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export function LegacyRuleDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/detections/rules/${id}`} replace />;
}

export function LegacyRuleEditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/detections/rules/${id}/edit`} replace />;
}
