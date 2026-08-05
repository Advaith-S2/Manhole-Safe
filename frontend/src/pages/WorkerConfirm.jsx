import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import Button from '../components/ui/Button';

// Opened from an SMS link on an unknown device — deliberately kept on the
// light surface (data-theme="light") rather than the app's default dark
// chrome, since it's a one-shot page with no navigation context to signal
// "this is ManholeSafe" the way the dark dashboards do.
export default function WorkerConfirm() {
  const { token } = useParams();
  const [preview, setPreview] = useState(null);
  const [previewState, setPreviewState] = useState('loading'); // loading | ready | already | expired | invalid
  const [state, setState] = useState('idle'); // idle | loading | done | already | expired | invalid
  const [message, setMessage] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getPermitPreview(token);
        setPreview(res);
        setPreviewState('ready');
      } catch (err) {
        if (err.status === 409) {
          setPreviewState('already');
          setMessage('This safety confirmation was already recorded.');
        } else if (err.message.includes('expired') || err.status === 401) {
          setPreviewState('expired');
          setMessage('The safety confirmation window for this entry has closed.');
        } else {
          setPreviewState('invalid');
          setMessage('This safety confirmation link is not valid.');
        }
      }
    })();
  }, [token]);

  async function handleConfirm() {
    setState('loading');
    try {
      const res = await api.confirmPermit(token);
      setData(res.data);
      setState('done');
    } catch (err) {
      if (err.status === 409) {
        setState('already');
        setMessage('This safety confirmation was already recorded.');
      } else if (err.message.includes('expired') || err.status === 401) {
        setState('expired');
        setMessage('The safety confirmation window for this entry has closed.');
      } else {
        setState('invalid');
        setMessage('This safety confirmation link is not valid.');
      }
    }
  }

  const isPending = previewState === 'ready' && state !== 'done' && state !== 'already' && state !== 'expired' && state !== 'invalid';

  return (
    <div
      data-theme="light"
      style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
        {state === 'done' ? (
          <>
            <div style={{ fontSize: 44, color: 'var(--status-good)', marginBottom: 14 }}>✓</div>
            <div className="display" style={{ fontSize: 22, fontWeight: 700, color: 'var(--status-good)', marginBottom: 8 }}>
              Thank you — stay safe.
            </div>
            {data && (
              <div className="mono" style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 10 }}>
                {data.manhole_id} · confirmed {new Date(data.confirmed_at).toLocaleTimeString()}
              </div>
            )}
          </>
        ) : previewState === 'loading' ? (
          <div style={{ fontSize: 14, color: 'var(--ink-muted)' }}>Loading safety check…</div>
        ) : isPending ? (
          <>
            <div className="display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4, marginBottom: 28, color: 'var(--ink-primary)' }}>
              Confirm you are safely out of Manhole {preview?.manhole_id}
            </div>
            <Button fullWidth size="lg" disabled={state === 'loading'} onClick={handleConfirm}>
              {state === 'loading' ? 'Confirming…' : "I'm Safe"}
            </Button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, color: 'var(--status-critical)', marginBottom: 14 }}>⚠</div>
            <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 20, color: 'var(--ink-primary)' }}>{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
