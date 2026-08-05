import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { setAuth } from '../api';

const MOBILE_BREAKPOINT = 700;

// Supervisor is a field tool — permit-open/exit requires camera + GPS, both
// of which are unreliable-to-absent on a desktop browser, and the gated
// step flow is designed around a phone screen. Rather than let it render
// (badly) on desktop, gate the whole surface behind a real width check.
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : true
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return isMobile;
}

export default function SupervisorLayout() {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();

  if (!isMobile) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--surface-0)',
          color: 'var(--ink-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📱</div>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
            Supervisor view is mobile-only
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            Opening and closing permits requires a phone's camera and GPS. Open this page on your phone,
            or narrow this window to continue anyway.
          </p>
          <button
            onClick={() => {
              setAuth(null);
              navigate('/login');
            }}
            style={{ background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--ink-primary)', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', color: 'var(--ink-primary)' }}>
      <div style={{ width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-hairline)',
          }}
        >
          <span className="display" style={{ fontWeight: 700, fontSize: 16 }}>
            MANHOLESAFE
          </span>
          <button
            onClick={() => {
              setAuth(null);
              navigate('/login');
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--ink-muted)', fontSize: 13, minHeight: 44, padding: '0 6px' }}
          >
            Log out
          </button>
        </div>
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
