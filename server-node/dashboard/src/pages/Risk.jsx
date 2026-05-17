/** @deprecated Use /overview?tab=executive (compact console). */
import { Navigate } from 'react-router-dom';

export default function Risk() {
  return <Navigate to="/overview?tab=executive" replace />;
}
