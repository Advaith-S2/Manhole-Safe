import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { setAuth } from '../../api';

// Shared chrome for every desktop surface (Admin, Contractor) — one header,
// one nav rail, one content frame, so the two dashboards read as the same
// product instead of two different apps bolted together.
export default function AppShell({ roleLabel, userLabel, navItems }) {
  const navigate = useNavigate();

  function logout() {
    setAuth(null);
    navigate('/login');
  }

  const navItemStyle = ({ isActive }) => ({
    display: 'block',
    padding: '10px 20px',
    color: isActive ? 'var(--accent)' : 'var(--ink-secondary)',
    textDecoration: 'none',
    fontSize: 13.5,
    fontWeight: isActive ? 700 : 500,
    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', color: 'var(--ink-primary)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <span className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.02em' }}>
          MANHOLESAFE
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          <span className="mono" style={{ color: 'var(--ink-secondary)' }}>
            {roleLabel}: {userLabel || '—'}
          </span>
          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              color: 'var(--ink-primary)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12.5,
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <div style={{ display: 'flex' }}>
        <nav style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border-hairline)', paddingTop: 12 }}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} style={navItemStyle}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main style={{ flex: 1, padding: 28, minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
