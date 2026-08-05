import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import QrScanStep from '../components/QrScanStep';
import ScannerErrorBoundary from '../components/ScannerErrorBoundary';
import CameraCapture from '../components/CameraCapture';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function SupervisorPermitFlow({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(mode === 'open' ? 'scan' : 'active_screen');
  const [qrToken, setQrToken] = useState('');
  const [scannedManhole, setScannedManhole] = useState(null);
  const [scanMethod, setScanMethod] = useState('camera');
  const [coords, setCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('');
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [permitEntry, setPermitEntry] = useState(null);
  const [loadingPermit, setLoadingPermit] = useState(mode === 'exit');
  const [secondsLeft, setSecondsLeft] = useState(null);

  // Fetch permit entry if we are in exit mode to get entry time and show active status
  useEffect(() => {
    if (mode === 'exit') {
      async function fetchPermit() {
        try {
          const res = await api.getPermitByWorkOrder(id);
          setPermitEntry(res);
        } catch (err) {
          setError('Could not retrieve active permit details.');
        } finally {
          setLoadingPermit(false);
        }
      }
      fetchPermit();
    }
  }, [id, mode]);

  // Live countdown pulled from the server-computed deadline
  // (permitEntry.entry_deadline = entry_time + the L1 escalation timer the
  // backend job actually polls against). Not a client-side guess, and not
  // reset by a page refresh — the deadline is a fixed instant fetched fresh
  // from the server on every mount.
  useEffect(() => {
    if (!permitEntry?.entry_deadline || step !== 'active_screen') return;

    const deadline = new Date(permitEntry.entry_deadline).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [permitEntry, step]);

  // The printed QR encodes a full URL (https://<domain>/scan/<qr_token>), not
  // the raw manhole id — extract the token whether the scanner returns the
  // full URL or (via the manual-entry fallback) just the bare token.
  function extractQrToken(scanned) {
    const trimmed = scanned.trim();
    const match = trimmed.match(/\/scan\/([^/?#]+)/);
    return match ? match[1] : trimmed;
  }

  async function handleScan(scanned, method) {
    const token = extractQrToken(scanned);
    setError('');
    setScanMethod(method);
    setStep('resolving');
    try {
      // Pure identity lookup — confirms which manhole this code points to and
      // lets us show it to the supervisor. It carries no authorization: the
      // real checks (does this supervisor's work order match this manhole)
      // run server-side on the actual open/exit submission below.
      const manhole = await api.resolveScan(token);
      setQrToken(token);
      setScannedManhole(manhole);
      setStep('gps');
      // GPS capture starts immediately on either path, camera scan or
      // manual entry — same trigger point, no delay either way.
      captureGpsAuto(method);
    } catch (err) {
      setScannedManhole(null);
      setError(
        err.status === 404
          ? "Unrecognized code. Rescan the manhole QR tag, or if entering manually, paste the full scan link — the printed manhole ID under the QR (e.g. \"MH-1102\") isn't the code the system checks."
          : err.message
      );
      setStep('scan');
    }
  }

  // Manual code entry has no camera-proximity signal at all — the supervisor
  // typed a code instead of physically pointing a camera at the tag. GPS is
  // the only remaining physical-presence signal for that path, so it can't
  // be allowed to silently degrade to location_missing=true the way the
  // camera-scan path can. Camera scan keeps the tolerant fallback.
  function captureGpsAuto(method) {
    setGpsBlocked(false);
    setGpsStatus('Capturing GPS location...');
    if (!navigator.geolocation) {
      if (method === 'manual') {
        setGpsStatus('');
        setGpsBlocked(true);
        return;
      }
      setGpsStatus('Location is not supported on this device. Proceeding with missing GPS status.');
      setTimeout(() => setStep('photo'), 1500);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('Location captured successfully!');
        setTimeout(() => setStep('photo'), 800);
      },
      (err) => {
        setCoords(null);
        if (method === 'manual') {
          setGpsStatus('');
          setGpsBlocked(true);
          return;
        }
        setGpsStatus('GPS acquisition failed or denied. Proceeding with missing GPS status.');
        setTimeout(() => setStep('photo'), 2000);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleCapture(file, previewUrl) {
    setPhotoFile(file);
    setPhotoPreview(previewUrl);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('work_order_id', id);
      formData.append('qr_token', qrToken);
      if (coords) {
        formData.append('lat', coords.lat);
        formData.append('lng', coords.lng);
      }
      formData.append('photo', photoFile);

      if (mode === 'open') {
        // Validation of worker phone format
        const phoneRegex = /^\+?[1-9]\d{9,14}$/;
        if (!phoneRegex.test(workerPhone)) {
          throw new Error('Worker phone must be a valid format (e.g. +919876543210).');
        }
        formData.append('worker_phone', workerPhone);

        if (emergencyPhone) {
          if (!phoneRegex.test(emergencyPhone)) {
            throw new Error('Emergency phone must be a valid format.');
          }
          formData.append('emergency_contact_phone', emergencyPhone);
        }
      }

      const res = mode === 'open' ? await api.openPermit(formData) : await api.exitPermit(formData);
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatTime(sec) {
    if (sec === null) return 'Calculating...';
    if (sec <= 0) return '00:00 (Overdue - Escalating)';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  if (loadingPermit) {
    return <div style={{ color: 'var(--ink-secondary)', padding: 24, textAlign: 'center' }}>Loading permit details…</div>;
  }

  if (step === 'active_screen') {
    return (
      <Screen title="Active permit" onBack={() => navigate('/supervisor')}>
        <Card padding={18} style={{ marginBottom: 20 }}>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            {permitEntry?.workOrder?.manhole?.qr_code_id}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-secondary)', display: 'grid', gap: 6, marginBottom: 14 }}>
            <div><strong style={{ color: 'var(--status-good)' }}>Status:</strong> In progress</div>
            <div><strong>Entry time:</strong> {new Date(permitEntry?.entry_time).toLocaleTimeString()}</div>
            <div><strong>Worker phone:</strong> {permitEntry?.worker_phone}</div>
          </div>
          <div style={{ borderTop: '1px dashed var(--border-hairline)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-muted)', marginBottom: 4 }}>
              Time remaining before escalation
            </div>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: secondsLeft <= 30 ? 'var(--status-critical)' : 'var(--ink-primary)' }}>
              {formatTime(secondsLeft)}
            </div>
          </div>
        </Card>

        <Button fullWidth size="lg" onClick={() => setStep('scan')}>
          Log exit
        </Button>
      </Screen>
    );
  }

  if (step === 'scan') {
    return (
      <div>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <ScannerErrorBoundary
          fallback={
            <div>
              <ErrorBanner>The camera scanner hit an error and was stopped. You can still continue below.</ErrorBanner>
              <QrScanStep key="fallback" onScan={handleScan} onCancel={() => navigate('/supervisor')} cameraDisabled />
            </div>
          }
        >
          <QrScanStep onScan={handleScan} onCancel={() => navigate('/supervisor')} />
        </ScannerErrorBoundary>
      </div>
    );
  }

  if (step === 'resolving') {
    return (
      <Screen title="Identifying manhole" onBack={() => setStep('scan')}>
        <Spinner label="Looking up scanned code…" />
      </Screen>
    );
  }

  if (step === 'gps') {
    if (gpsBlocked) {
      return (
        <Screen title="Location required" onBack={() => setStep('scan')}>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
            <p style={{ fontSize: 14, color: 'var(--status-critical)', lineHeight: 1.6, marginBottom: 8, fontWeight: 600 }}>
              Location is required for a manually entered code.
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
              A typed code has no camera-proximity signal, so GPS is the only remaining check that you're
              physically at the manhole. Allow location access and try again, or scan the QR code with the
              camera instead.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <Button fullWidth size="lg" onClick={() => captureGpsAuto('manual')}>
                Try location again
              </Button>
              <Button variant="secondary" fullWidth size="lg" onClick={() => setStep('scan')}>
                Scan QR code instead
              </Button>
            </div>
          </div>
        </Screen>
      );
    }
    return (
      <Screen title="Capturing GPS" onBack={() => setStep('scan')}>
        <Spinner label={gpsStatus} />
      </Screen>
    );
  }

  if (step === 'photo') {
    return (
      <Screen title="Evidence photo" onBack={() => setStep('scan')}>
        {photoPreview ? (
          <>
            <img src={photoPreview} alt="Captured" style={{ width: '100%', borderRadius: 8, marginBottom: 14, border: '1px solid var(--border-hairline)' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                variant="secondary"
                fullWidth
                size="lg"
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview('');
                }}
              >
                Retake
              </Button>
              <Button fullWidth size="lg" onClick={() => setStep(mode === 'open' ? 'phone' : 'submit')}>
                Use photo
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 14, marginBottom: 16, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
              Take a live photo of the {mode === 'open' ? 'worker entering' : 'worker exiting'} the manhole. The camera
              opens directly — there is no option to choose an existing photo.
            </p>
            <CameraCapture onCapture={handleCapture} onCancel={() => setStep('scan')} label={mode === 'open' ? 'entry' : 'exit'} />
          </>
        )}
      </Screen>
    );
  }

  if (step === 'phone') {
    return (
      <Screen title="Worker details" onBack={() => setStep('photo')}>
        <p style={{ fontSize: 14, marginBottom: 16, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
          Enter the worker's phone number. They will receive the safety confirmation SMS upon exit.
        </p>
        <div style={{ display: 'grid', gap: 14, marginBottom: 20 }}>
          <Field label="Worker phone *">
            <input
              type="tel"
              required
              placeholder="+919999999999"
              value={workerPhone}
              onChange={(e) => setWorkerPhone(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Emergency contact phone (optional)">
            <input
              type="tel"
              placeholder="+918888888888"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
        <Button fullWidth size="lg" disabled={!workerPhone} onClick={() => setStep('submit')}>
          Continue
        </Button>
      </Screen>
    );
  }

  if (step === 'submit') {
    return (
      <Screen title={mode === 'open' ? 'Open permit' : 'Log exit'} onBack={() => setStep(mode === 'open' ? 'phone' : 'photo')}>
        <Card padding={16} style={{ marginBottom: 16, fontSize: 14, display: 'grid', gap: 6 }}>
          <div><strong>Manhole:</strong> {scannedManhole?.qr_code_id || '—'} {scannedManhole?.ward ? `· ${scannedManhole.ward}` : ''}</div>
          {coords ? (
            <div><strong>GPS location:</strong> Captured ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})</div>
          ) : (
            <div style={{ color: 'var(--status-critical)' }}><strong>GPS location:</strong> Not captured (missing GPS)</div>
          )}
          {mode === 'open' && <div><strong>Worker phone:</strong> {workerPhone}</div>}
        </Card>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Button fullWidth size="lg" disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'Submitting…' : mode === 'open' ? 'Open permit' : 'Log exit'}
        </Button>
      </Screen>
    );
  }

  if (step === 'done') {
    return (
      <div style={{ textAlign: 'center', paddingTop: 40 }}>
        <div style={{ fontSize: 40, color: 'var(--status-good)', marginBottom: 12 }}>✓</div>
        <div className="display" style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
          {mode === 'open' ? 'Permit opened' : 'Exit logged — waiting for worker confirmation'}
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
          {mode === 'open'
            ? 'Worker has been notified by SMS.'
            : 'The worker has been sent a confirmation link by SMS. The permit is not closed until they confirm — this is not the final step.'}
        </p>
        {!coords && (
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--status-critical)', padding: 12, borderRadius: 'var(--radius-md)', color: 'var(--status-critical)', fontSize: 13, marginBottom: 16, textAlign: 'left', lineHeight: 1.4 }}>
            Notice: No GPS coordinates were captured. The permit is allowed to proceed, but has been flagged with missing location.
          </div>
        )}
        {result?.location_warning && coords && (
          <p style={{ color: 'var(--status-warning)', fontSize: 13, marginBottom: 16 }}>
            ⚠ Recorded location was {result.distance_meters}m from the manhole — flagged for admin review.
          </p>
        )}
        <Button fullWidth size="lg" onClick={() => navigate('/supervisor')}>
          Back to today
        </Button>
      </div>
    );
  }

  return null;
}

function Screen({ title, onBack, children }) {
  return (
    <div>
      <button onClick={onBack} style={backLink}>
        ← Back
      </button>
      <div className="display" style={{ fontSize: 18, fontWeight: 700, margin: '10px 0 18px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Spinner({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: 15, marginBottom: 16, lineHeight: 1.5, color: 'var(--ink-secondary)' }}>{label}</div>
      <div style={{ width: 28, height: 28, border: '3px solid var(--surface-3)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s infinite linear', margin: '0 auto' }} />
    </div>
  );
}

function ErrorBanner({ children }) {
  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--status-critical)', padding: 12, borderRadius: 'var(--radius-md)', color: 'var(--status-critical)', fontSize: 13, marginBottom: 14, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

const backLink = {
  background: 'transparent',
  border: 'none',
  fontSize: 14,
  padding: '10px 0',
  minHeight: 44,
  color: 'var(--ink-secondary)',
  cursor: 'pointer',
};

const inputStyle = {
  width: '100%',
  padding: '13px 14px',
  border: '1px solid var(--border-hairline)',
  borderRadius: 8,
  fontSize: 15,
  background: 'var(--surface-2)',
  color: 'var(--ink-primary)',
  outline: 'none',
  minHeight: 'var(--touch-target)',
};
