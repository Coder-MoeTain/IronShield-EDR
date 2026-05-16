import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

export function LegacyAlertRedirect() {
  const { id } = useParams();
  return <Navigate to={`/detections/alerts/${id}`} replace />;
}

export function LegacyIncidentRedirect() {
  const { id } = useParams();
  return <Navigate to={`/investigation/incidents/${id}`} replace />;
}

export function LegacyCaseRedirect() {
  const { id } = useParams();
  return <Navigate to={`/investigation/cases/${id}`} replace />;
}

export function LegacyMalwareAlertRedirect() {
  const { id } = useParams();
  return <Navigate to={`/detections/alerts/${id}`} replace />;
}
