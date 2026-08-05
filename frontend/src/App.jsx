import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import AdminLayout from './pages/AdminLayout';
import AdminLedger from './pages/AdminLedger';
import AdminWorkOrderCreate from './pages/AdminWorkOrderCreate';
import AdminQrCodes from './pages/AdminQrCodes';
import SupervisorLayout from './pages/SupervisorLayout';
import SupervisorToday from './pages/SupervisorToday';
import SupervisorPermitFlow from './pages/SupervisorPermitFlow';
import ContractorLayout from './pages/ContractorLayout';
import ContractorDashboard from './pages/ContractorDashboard';
import WorkerConfirm from './pages/WorkerConfirm';
import ScanResolve from './pages/ScanResolve';
import { getRole } from './api';

function Protected({ role, children }) {
  const current = getRole();
  if (!current) return <Navigate to="/login" replace />;
  if (role && current !== role) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/confirm/:token" element={<WorkerConfirm />} />
      <Route path="/scan/:qr_token" element={<ScanResolve />} />

      <Route
        path="/admin"
        element={
          <Protected role="admin">
            <AdminLayout />
          </Protected>
        }
      >
        <Route index element={<AdminLedger />} />
        <Route path="work-orders/new" element={<AdminWorkOrderCreate />} />
        <Route path="qr-codes" element={<AdminQrCodes />} />
      </Route>

      <Route
        path="/supervisor"
        element={
          <Protected role="supervisor">
            <SupervisorLayout />
          </Protected>
        }
      >
        <Route index element={<SupervisorToday />} />
        <Route path="open/:id" element={<SupervisorPermitFlow mode="open" />} />
        <Route path="exit/:id" element={<SupervisorPermitFlow mode="exit" />} />
      </Route>

      <Route
        path="/contractor"
        element={
          <Protected role="contractor">
            <ContractorLayout />
          </Protected>
        }
      >
        <Route index element={<ContractorDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
