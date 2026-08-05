import { useEffect, useState } from 'react';
import { api, API_URL, getToken } from '../api';
import StatusBadge from '../components/StatusBadge';
import TimerRing from '../components/TimerRing';
import Button from '../components/ui/Button';

const ESCALATION_THRESHOLD_SECONDS = 60 * 60; // 1 hour, matches backend's typical timer window

export default function PermitDetail({ workOrder, onClose, onChanged }) {
  const [permit, setPermit] = useState(null);
  const [permitError, setPermitError] = useState('');
  const [loadingPermit, setLoadingPermit] = useState(true);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPermit(true);
      setPermitError('');
      try {
        const res = await api.getPermitByWorkOrder(workOrder.id);
        if (!cancelled) setPermit(res);
      } catch (err) {
        if (!cancelled) setPermitError(err.status === 404 ? 'No permit opened yet for this work order.' : err.message);
      } finally {
        if (!cancelled) setLoadingPermit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workOrder.id]);

  useEffect(() => {
    if (!permit?.entry_time || permit.status === 'closed') return;
    const start = new Date(permit.entry_time).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [permit]);

  async function handleResolve(e) {
    e.preventDefault();
    setError('');
    if (!note.trim()) {
      setError('A resolution reason is required.');
      return;
    }
    if (!permit?.id) {
      setError('No permit ID available to resolve.');
      return;
    }
    setBusy(true);
    try {
      await api.resolvePermit(permit.id, note);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete work order MH-${workOrder.manhole?.qr_code_id}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteWorkOrder(workOrder.id);
      onChanged();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  const displayStatus = permit?.status || workOrder.status;
  const canResolve = permit && ['unconfirmed', 'escalated'].includes(permit.status);
  const showTimer = permit && permit.status === 'in_progress';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: '100%',
          background: 'var(--surface-0)',
          color: 'var(--ink-primary)',
          height: '100%',
          overflowY: 'auto',
          padding: 26,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
              {workOrder.manhole?.qr_code_id ?? `MH-${workOrder.manhole_id}`}
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <StatusBadge status={displayStatus} />
              {permit?.location_missing && (
                <span style={{ color: 'var(--status-warning)', fontSize: 12.5, fontWeight: 600 }}>⚠ GPS missing</span>
              )}
              {permit?.location_mismatch && (
                <span style={{ color: 'var(--status-critical)', fontSize: 12.5, fontWeight: 600 }}>⚠ GPS mismatch</span>
              )}
              {permit && (
                <span style={{ color: permit.ppe_verified ? 'var(--status-good)' : 'var(--status-warning)', fontSize: 12.5, fontWeight: 600 }}>
                  {permit.ppe_verified ? '✓ PPE verified' : '⚠ PPE not verified'}
                </span>
              )}
            </div>
          </div>
          {showTimer && <TimerRing elapsedSeconds={elapsed} thresholdSeconds={ESCALATION_THRESHOLD_SECONDS} size={76} />}
          <button onClick={onClose} style={closeBtn} aria-label="Close">
            ✕
          </button>
        </div>

        <Section title="Work order">
          <Row label="Ward" value={workOrder.manhole?.ward} />
          <Row label="Contractor" value={workOrder.contractor?.name} />
          <Row label="Supervisor" value={`${workOrder.supervisor?.name ?? ''} (${workOrder.supervisor?.phone ?? ''})`} />
          <Row label="Scheduled" value={new Date(workOrder.scheduled_time).toLocaleString()} mono />
          <Row label="Payment status" value={workOrder.payment_status} />
        </Section>

        {loadingPermit && <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>Loading permit…</div>}
        {permitError && <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 18 }}>{permitError}</div>}

        {permit && (
          <>
            {permit.worker_confirmed_time && (
              <div
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--status-good)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--status-good)', marginBottom: 4 }}>
                  ✓ Worker confirmed safe exit
                </div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
                  {fmt(permit.worker_confirmed_time)}
                </div>
              </div>
            )}

            <Section title="Ledger timeline">
              <Row label="Entry" value={fmt(permit.entry_time)} mono />
              <Row label="Exit logged" value={fmt(permit.exit_time)} mono />
              <Row label="Worker confirmed" value={fmt(permit.worker_confirmed_time)} mono />
              {permit.worker_confirm_expires_at && !permit.worker_confirmed_time && (
                <Row label="Confirmation window closes" value={fmt(permit.worker_confirm_expires_at)} mono />
              )}
              {permit.admin_resolution_note && <Row label="Admin note" value={permit.admin_resolution_note} />}
            </Section>

            <Section title="Contact">
              <Row label="Worker phone" value={permit.worker_phone} mono />
              <Row label="Emergency contact" value={maskPhone(permit.emergency_contact_phone)} mono />
            </Section>

            <Section title="GPS readout">
              <Row
                label="Entry lat, lng"
                value={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <span className="mono">{permit.entry_lat != null ? `${permit.entry_lat.toFixed(5)}, ${permit.entry_lng.toFixed(5)}` : '—'}</span>
                    {permit.location_missing && permit.entry_lat == null && (
                      <span style={{ color: 'var(--status-critical)', fontSize: 11, fontWeight: 700 }}>[MISSING]</span>
                    )}
                    {permit.entry_distance_meters != null && permit.entry_distance_meters > 40 && (
                      <span style={{ color: 'var(--status-warning)', fontSize: 11, fontWeight: 700 }}>[MISMATCH]</span>
                    )}
                  </div>
                }
              />
              <Row
                label="Entry distance from manhole"
                value={permit.entry_distance_meters != null ? `${permit.entry_distance_meters} m` : '—'}
              />
              <Row
                label="Exit lat, lng"
                value={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <span className="mono">{permit.exit_lat != null ? `${permit.exit_lat.toFixed(5)}, ${permit.exit_lng.toFixed(5)}` : '—'}</span>
                    {permit.exit_time && permit.exit_lat == null && (
                      <span style={{ color: 'var(--status-critical)', fontSize: 11, fontWeight: 700 }}>[MISSING]</span>
                    )}
                    {permit.exit_distance_meters != null && permit.exit_distance_meters > 40 && (
                      <span style={{ color: 'var(--status-warning)', fontSize: 11, fontWeight: 700 }}>[MISMATCH]</span>
                    )}
                  </div>
                }
              />
              <Row
                label="Exit distance from manhole"
                value={permit.exit_distance_meters != null ? `${permit.exit_distance_meters} m` : '—'}
              />
            </Section>

            <Section title="PPE detection">
              <Row
                label="Status"
                value={
                  <span style={{ color: permit.ppe_verified ? 'var(--status-good)' : 'var(--status-warning)', fontWeight: 600 }}>
                    {permit.ppe_verified ? 'Verified' : 'Not verified'}
                  </span>
                }
              />
              {permit.ppe_detection_result?.model && (
                <Row label="Model" value={permit.ppe_detection_result.model} mono />
              )}
              {permit.ppe_detection_result?.error && (
                <Row label="Check failed" value={permit.ppe_detection_result.error} />
              )}
              {Array.isArray(permit.ppe_detection_result?.predictions) && (
                <Row
                  label="Detections"
                  value={
                    permit.ppe_detection_result.predictions.length === 0
                      ? 'None'
                      : permit.ppe_detection_result.predictions
                          .map((p) => `${p.class} (${Math.round((p.confidence ?? 0) * 100)}%)`)
                          .join(', ')
                  }
                />
              )}
              {!permit.ppe_detection_result && (
                <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>PPE detection was not run for this permit (no Roboflow key configured).</div>
              )}
            </Section>

            {(permit.entry_photo_path || permit.exit_photo_path) && (
              <Section title="Photos">
                <div style={{ display: 'flex', gap: 10 }}>
                  {permit.entry_photo_path && <PhotoThumb label="Entry" path={permit.entry_photo_path} />}
                  {permit.exit_photo_path && <PhotoThumb label="Exit" path={permit.exit_photo_path} />}
                </div>
              </Section>
            )}

            <Section title="SMS history">
              {permit.sms_logs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>No messages sent yet.</div>
              ) : (
                permit.sms_logs.map((s) => (
                  <Row key={s.id} label={s.message_type} value={`${s.delivery_status} · ${fmt(s.sent_at)}`} mono />
                ))
              )}
            </Section>
          </>
        )}

        {canResolve && (
          <Section title="Resolve stuck permit">
            <p style={{ fontSize: 12.5, color: 'var(--ink-secondary)', marginBottom: 10 }}>
              This permit is {permit.status}. Record why it's being closed manually.
            </p>
            <form onSubmit={handleResolve}>
              <label style={fieldLabel}>Resolution reason</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              {error && <div style={{ color: 'var(--status-critical)', fontSize: 12.5, margin: '8px 0' }}>{error}</div>}
              <Button type="submit" disabled={busy || !note.trim()} fullWidth style={{ marginTop: 8 }}>
                {busy ? 'Resolving…' : 'Resolve permit'}
              </Button>
            </form>
          </Section>
        )}

        {error && !canResolve && <div style={{ color: 'var(--status-critical)', fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

        <Button variant="danger" fullWidth disabled={deleting} onClick={handleDelete} style={{ marginTop: 10 }}>
          {deleting ? 'Deleting…' : 'Delete work order'}
        </Button>
      </div>
    </div>
  );
}

function fmt(d) {
  return d ? new Date(d).toLocaleString() : '—';
}

function maskPhone(phone) {
  if (!phone) return '—';
  return phone.length > 4 ? `${phone.slice(0, -4).replace(/\d/g, '•')}${phone.slice(-4)}` : phone;
}

function PhotoThumb({ label, path }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoke;
    (async () => {
      try {
        const res = await fetch(`${API_URL.replace(/\/api$/, '')}${path}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error('failed');
        const blob = await res.blob();
        revoke = URL.createObjectURL(blob);
        setSrc(revoke);
      } catch {
        setFailed(true);
      }
    })();
    return () => revoke && URL.revokeObjectURL(revoke);
  }, [path]);

  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginBottom: 4 }}>{label}</div>
      {failed ? (
        <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>Unavailable</div>
      ) : src ? (
        <img src={src} alt={`${label} evidence`} style={{ width: '100%', borderRadius: 4, border: '1px solid var(--border-hairline)' }} />
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>Loading…</div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        className="display"
        style={{ fontSize: 12.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, color: 'var(--ink-muted)' }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, padding: '5px 0', borderBottom: '1px dashed var(--border-hairline)' }}>
      <span style={{ color: 'var(--ink-secondary)', flexShrink: 0 }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{ textAlign: 'right', wordBreak: 'break-word' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

const closeBtn = {
  background: 'transparent',
  border: 'none',
  fontSize: 18,
  lineHeight: 1,
  padding: 4,
  color: 'var(--ink-primary)',
};

const fieldLabel = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-secondary)', marginBottom: 4, marginTop: 8 };

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--border-hairline)',
  borderRadius: 4,
  fontSize: 13.5,
  background: 'var(--surface-2)',
  color: 'var(--ink-primary)',
};
