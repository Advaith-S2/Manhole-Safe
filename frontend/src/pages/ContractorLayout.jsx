import AppShell from '../components/ui/AppShell';
import { getUser } from '../api';

export default function ContractorLayout() {
  const user = getUser();
  return (
    <AppShell
      roleLabel="Contractor"
      userLabel={user?.username}
      navItems={[{ to: '/contractor', label: 'Dashboard', end: true }]}
    />
  );
}
