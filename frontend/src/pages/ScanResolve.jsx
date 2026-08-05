import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getRole } from '../api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Landing page for the URL printed inside the QR itself
// (https://<domain>/scan/<qr_token>), reached when a camera app's "open
// link" action is used instead of the in-app scanner. This is a pure
// identity lookup — it shows which manhole the code belongs to and nothing
// else. It never opens a permit; that still requires picking the specific
// work order from the supervisor's own list, where the real authorization
// checks run.
export default function ScanResolve() {
  const { qr_token } = useParams();
  const navigate = useNavigate();
  const [manhole, setManhole] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.resolveScan(qr_token);
        if (!cancelled) setManhole(res);
      } catch (err) {
        if (!cancelled) setError(err.status === 404 ? 'Unrecognized code.' : err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qr_token]);

  const role = getRole();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--surface-0)' }}>
      <Card style={{ maxWidth: 380, width: '100%', textAlign: 'center' }} padding={28}>
        {loading && <div style={{ fontSize: 14, color: 'var(--ink-secondary)' }}>Looking up scanned code…</div>}

        {!loading && error && (
          <>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚠</div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{error}</div>
            <p style={{ fontSize: 13.5, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
              This code doesn't match a known manhole. If this is a printed sticker, check for damage or contact your supervisor.
            </p>
          </>
        )}

        {!loading && !error && manhole && (
          <>
            <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Manhole identified</div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{manhole.qr_code_id}</div>
            <div style={{ fontSize: 14, color: 'var(--ink-secondary)', marginBottom: 20 }}>Ward {manhole.ward}</div>
            <p style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              Scanning identifies the manhole only — it does not open or close a permit. To log an entry or exit, use the scan step inside your assigned work order.
            </p>
            {role === 'supervisor' && (
              <Button fullWidth size="lg" onClick={() => navigate('/supervisor')}>
                Go to my work orders
              </Button>
            )}
            {!role && (
              <Button fullWidth size="lg" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
