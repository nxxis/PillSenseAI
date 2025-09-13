import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute() {
  const { token } = useAuth();
  const location = useLocation();
  if (!token)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
