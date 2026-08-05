import { useEffect, useState } from 'react';
import { api } from '../api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function AdminQrCodes() {
  const [manholes, setManholes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    try {
      const rows = await api.getReferenceManholes();
      setManholes(rows);
    } catch (err) {
      setError(err.message || 'Unable to load manholes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSingle(manhole) {
    setBusyId(manhole.id);
    setError('');
    try {
      await api.downloadQrLabel(manhole.id, `${manhole.qr_code_id}-qr-label.svg`);
    } catch (err) {
      setError(err.message || 'Unable to generate the QR label.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulk() {
    setBulkBusy(true);
    setError('');
    try {
      await api.downloadQrBulk();
    } catch (err) {
      setError(err.message || 'Unable to generate QR labels.');
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Manhole tags</div>
          <div className="display" style={{ fontSize: 32, fontWeight: 700 }}>QR codes</div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-secondary)', marginTop: 6, maxWidth: 560, lineHeight: 1.5 }}>
            Each label encodes a scan link tied to the manhole's private token — never the manhole id itself — so a
            photographed or reused sticker can only identify a manhole, not open a permit against it.
          </p>
          <p style={{ fontSize: 13, color: 'var(--status-warning)', marginTop: 8, maxWidth: 560, lineHeight: 1.5 }}>
            GPS coordinates below come from seed data and never change on their own — set each manhole's real
            coordinates here, or every scan there will show as a large distance mismatch.
          </p>
        </div>
        <Button onClick={handleBulk} disabled={bulkBusy || loading}>
          {bulkBusy ? 'Preparing…' : 'Download all labels (.zip)'}
        </Button>
      </div>

      {error && <div style={{ color: 'var(--status-critical)', fontSize: 13.5 }}>{error}</div>}

      <Card padding={18}>
        {loading && <div style={{ color: 'var(--ink-secondary)' }}>Loading manholes…</div>}
        {!loading && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--ink-muted)', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  <th style={thStyle}>Manhole</th>
                  <th style={thStyle}>Ward</th>
                  <th style={thStyle}>GPS location</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {manholes.map((manhole) => (
                  <>
                    <tr key={manhole.id} style={{ borderTop: '1px solid var(--border-hairline)', fontSize: 14 }}>
                      <td style={tdStyle}>{manhole.qr_code_id}</td>
                      <td style={tdStyle}>{manhole.ward}</td>
                      <td style={tdStyle} className="mono">
                        {manhole.lat != null && manhole.lng != null ? `${manhole.lat.toFixed(4)}, ${manhole.lng.toFixed(4)}` : '—'}
                      </td>
                      <td style={{ ...tdStyle, display: 'flex', gap: 8 }}>
                        <Button size="sm" disabled={busyId === manhole.id} onClick={() => handleSingle(manhole)}>
                          {busyId === manhole.id ? 'Preparing…' : 'Download label'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingId(editingId === manhole.id ? null : manhole.id)}
                        >
                          {editingId === manhole.id ? 'Cancel' : 'Set location'}
                        </Button>
                      </td>
                    </tr>
                    {editingId === manhole.id && (
                      <tr>
                        <td colSpan={4} style={{ padding: '4px 12px 16px' }}>
                          <LocationEditor
                            manhole={manhole}
                            onSaved={() => {
                              setEditingId(null);
                              load();
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function LocationEditor({ manhole, onSaved }) {
  const [lat, setLat] = useState(manhole.lat ?? '');
  const [lng, setLng] = useState(manhole.lng ?? '');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await api.updateManholeLocation(manhole.id, lat, lng);
      onSaved();
    } catch (err) {
      setError(err.message || 'Unable to save location.');
    } finally {
      setSaving(false);
    }
  }

  function useCurrentLocation() {
    setError('');
    if (!navigator.geolocation) {
      setError('Location is not supported in this browser.');
      return;
    }
    // Not a secure-context issue in normal use (localhost and the ngrok
    // HTTPS tunnel both qualify) — the two things that actually cause
    // silent-feeling failures here are (a) the browser's permission prompt
    // appearing near the address bar, easy to miss with no reaction in the
    // page itself, and (b) a denied/blocked permission, which previously
    // showed the same generic message as every other failure. Both are
    // fixed below: a visible "locating…" state, and the real reason for a
    // failure instead of one catch-all string.
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission was denied. Check your browser\'s site settings and allow location for this page, then try again.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Your device could not determine a location right now.');
        } else if (err.code === err.TIMEOUT) {
          setError('Location request timed out. Try again.');
        } else {
          setError('Could not read your current location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <Card padding={14} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <label style={{ display: 'block' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 4 }}>Latitude</div>
        <input
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          style={{ width: 140, padding: '8px 10px', border: '1px solid var(--border-hairline)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-primary)', fontSize: 13 }}
        />
      </label>
      <label style={{ display: 'block' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 4 }}>Longitude</div>
        <input
          type="number"
          step="any"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          style={{ width: 140, padding: '8px 10px', border: '1px solid var(--border-hairline)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-primary)', fontSize: 13 }}
        />
      </label>
      <Button size="sm" variant="secondary" disabled={locating} onClick={useCurrentLocation}>
        {locating ? 'Locating…' : 'Use my current location'}
      </Button>
      <Button size="sm" disabled={saving || lat === '' || lng === ''} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save location'}
      </Button>
      {error && <div style={{ fontSize: 12, color: 'var(--status-critical)', width: '100%' }}>{error}</div>}
    </Card>
  );
}

const thStyle = {
  padding: '10px 12px',
  color: 'var(--ink-muted)',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const tdStyle = {
  padding: '14px 12px',
  verticalAlign: 'middle',
  color: 'var(--ink-primary)',
  whiteSpace: 'nowrap',
};
