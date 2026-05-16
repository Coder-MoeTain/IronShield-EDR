import React, { lazy } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import EmbeddedPanel from '../../components/EmbeddedPanel';

const IncidentDetail = lazy(() => import('./tabs/IncidentDetailTab'));
const InvestigationDetail = lazy(() => import('./tabs/InvestigationDetailTab'));

export default function InvestigationDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const isCase = location.pathname.includes('/investigation/cases/');

  return (
    <EmbeddedPanel label={isCase ? 'Case detail' : 'Incident detail'}>
      {isCase ? <InvestigationDetail key={id} /> : <IncidentDetail key={id} />}
    </EmbeddedPanel>
  );
}
