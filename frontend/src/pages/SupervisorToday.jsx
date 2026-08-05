import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Plain-language labels for the supervisor's own list. permit?.status (the
// live PermitEntry state) takes priority over the work order's own status
// once a permit exists, since that's the more granular/current signal.
const STATUS_LABELS = {
  pending: 'Not started',
  in_progress: 'In progress',
  pending_confirmation: 'Awaiting confirmation',
  unconfirmed: 'Awaiting confirmation',
  escalated: 'Escalated',
  closed: 'Closed',
  completed: 'Closed',
};

export default function SupervisorToday() {
  const [orders, setOrders] = useState([]);
  const [permits, setPermits] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        // The backend scopes this to the authenticated supervisor's own
        // work orders from the auth token — never from a client-supplied
        // supervisor id, so there is nothing to filter client-side here.
        const [pending, inProgress] = await Promise.all([
          api.getWorkOrders({ status: 'pending' }),
          api.getWorkOrders({ status: 'in_progress' }),
        ]);
        const all = [...pending, ...inProgress].sort(
          (a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time)
        );
        setOrders(all);

        const entries = await Promise.all(
          all
            .filter((wo) => wo.status === 'in_progress')
            .map(async (wo) => {
              try {
                const permit = await api.getPermitByWorkOrder(wo.id);
                return [wo.id, permit];
              } catch {
                return [wo.id, null];
              }
            })
        );
        setPermits(Object.fromEntries(entries.filter(([, permit]) => permit)));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div className="display" style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Today
      </div>
      {loading && <div style={{ color: 'var(--ink-secondary)', fontSize: 14 }}>Loading work orders…</div>}
      {error && <div style={{ color: 'var(--status-critical)', fontSize: 14 }}>{error}</div>}
      {!loading && !error && orders.length === 0 && (
        <div style={{ color: 'var(--ink-muted)', fontSize: 14 }}>No work orders assigned to you right now.</div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {orders.map((wo) => {
          const permit = permits[wo.id];
          const liveStatus = permit?.status || wo.status;
          return (
            <Card key={wo.id} padding={16}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
                {wo.manhole?.qr_code_id ?? `MH-${wo.manhole_id}`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-secondary)', margin: '4px 0 6px' }}>
                {wo.contractor?.name || '—'} · {wo.manhole?.ward} ·{' '}
                {new Date(wo.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <StatusLine status={liveStatus} />
              <div style={{ marginTop: 14 }}>
                {liveStatus === 'pending' && (
                  <Button fullWidth size="lg" onClick={() => navigate(`/supervisor/open/${wo.id}`)}>
                    Open permit
                  </Button>
                )}
                {liveStatus === 'in_progress' && (
                  <Button fullWidth size="lg" onClick={() => navigate(`/supervisor/exit/${wo.id}`)}>
                    Log exit
                  </Button>
                )}
                {['pending_confirmation', 'unconfirmed', 'escalated'].includes(liveStatus) && (
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Waiting on worker confirmation or admin action.</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusLine({ status }) {
  const label = STATUS_LABELS[status] || status;
  const tone =
    status === 'escalated' || status === 'unconfirmed'
      ? 'var(--status-critical)'
      : status === 'pending_confirmation'
      ? 'var(--status-warning)'
      : status === 'in_progress'
      ? 'var(--status-good)'
      : 'var(--ink-secondary)';
  return (
    <div style={{ fontSize: 13.5, fontWeight: 700, color: tone }}>
      {label}
    </div>
  );
}
