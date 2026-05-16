import React from 'react';
import { falconSeverityClass } from '../utils/falconUi';

export default function SeverityBadge({ severity, children }) {
  const label = children ?? severity ?? 'info';
  return <span className={falconSeverityClass(severity)}>{label}</span>;
}
