import React, { lazy } from 'react';
import { useParams } from 'react-router-dom';
import EmbeddedPanel from '../../components/EmbeddedPanel';

const AlertDetail = lazy(() => import('../../pages/AlertDetail'));
const AvMalwareAlertDetail = lazy(() => import('../../pages/AvMalwareAlertDetail'));

/** Full-page alert detail (alerts and AV malware alerts). */
export default function AlertDetailPage() {
  const { id } = useParams();
  const path = window.location.pathname || '';
  const isAv = path.includes('/detections/malware/');

  return (
    <EmbeddedPanel label={isAv ? 'Malware alert detail' : 'Alert detail'}>
      {isAv ? <AvMalwareAlertDetail /> : <AlertDetail key={id} />}
    </EmbeddedPanel>
  );
}
