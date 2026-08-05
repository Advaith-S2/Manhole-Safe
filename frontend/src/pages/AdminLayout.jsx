import AppShell from '../components/ui/AppShell';
import { getUser } from '../api';

export default function AdminLayout() {
  const user = getUser();
  return (
    <AppShell
      roleLabel="Admin"
      userLabel={user?.username}
      navItems={[
        { to: '/admin', label: 'Dashboard', end: true },
        { to: '/admin/work-orders/new', label: 'New Work Order' },
        { to: '/admin/qr-codes', label: 'QR Codes' },
      ]}
    />
  );
}
