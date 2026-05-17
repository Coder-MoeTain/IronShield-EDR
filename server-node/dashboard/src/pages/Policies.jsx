/** @deprecated Use /protection?tab=policies (compact console). */
import { Navigate } from 'react-router-dom';

export default function Policies() {
  return <Navigate to="/protection?tab=policies" replace />;
}
