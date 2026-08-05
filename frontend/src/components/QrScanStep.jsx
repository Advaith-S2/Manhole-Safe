import { useEffect, useRef, useState } from 'react';

// Square scan window, sized as a share of the viewport's shorter edge so it
// stays square and reasonably large on any phone screen — a bigger box means
// the supervisor doesn't have to aim as precisely, which is most of what
// made scanning feel slow (decode itself was already fast; framing the code
// inside a small 240px box wasn't).
function computeQrBox() {
  const edge = Math.min(window.innerWidth, window.innerHeight);
  const size = Math.round(Math.min(edge * 0.7, 320));
  return { width: size, height: size };
}

// Module-level (not per-instance) lock keyed by nothing but a single flag:
// Html5Qrcode is bound to a fixed DOM id ('qr-reader'), so if a second
// instance calls start() while a previous one is still acquiring/releasing
// the camera — e.g. React StrictMode's dev-only double-mount, or a fast
// unmount/remount when the supervisor backs out and rescans — the two
// getUserMedia calls race. The loser used to fail silently (caught and
// swallowed) leaving a black, permanently non-scanning box with no visible
// error. This lock serializes start/stop across instances so only one
// Html5Qrcode is ever live against that DOM id at a time.
let scannerLock = Promise.resolve();

export default function QrScanStep({ onScan, onCancel, cameraDisabled = false }) {
  const ref = useRef(null);
  const scannerRef = useRef(null);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (cameraDisabled) return;
    let cancelled = false;
    // Tracks whether the scanner is actually mid-scan, so both the
    // success-callback stop and the unmount-cleanup stop can't both fire.
    // A successful decode stops the scanner and (via onScan) triggers a
    // parent state change that unmounts this component in the same tick —
    // the cleanup below then ran stop() a second time on an
    // already-stopping/stopped instance, which html5-qrcode throws
    // synchronously for ("Cannot stop, scanner is not running or paused."),
    // uncaught, inside a passive-effect cleanup — React had no boundary for
    // that and blanked the screen.
    const runningRef = { current: false };

    scannerLock = scannerLock.then(() =>
      import('html5-qrcode').then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
        if (cancelled) return;
        // Restrict decoding to QR only (default tries every barcode format
        // html5-qrcode supports, which costs time on every single frame for
        // no benefit here — manholes only ever get QR labels).
        const scanner = new Html5Qrcode('qr-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = scanner;
        return scanner
          .start(
            { facingMode: 'environment' },
            // 15fps (up from 10) means more decode attempts per second; a
            // bigger, viewport-relative square box (up from a flat 240px)
            // means the supervisor doesn't have to aim as precisely to get
            // the code inside it — together these are most of what made
            // scanning feel slow, not the decode itself.
            { fps: 15, qrbox: computeQrBox(), aspectRatio: 1 },
            (decodedText) => {
              if (!runningRef.current) return;
              runningRef.current = false;
              scanner.stop().catch(() => {});
              onScan(decodedText, 'camera');
            },
            () => {}
          )
          .then(() => {
            if (cancelled) {
              // Unmounted while start() was still resolving — stop immediately.
              runningRef.current = false;
              return scanner.stop().catch(() => {});
            }
            runningRef.current = true;
          })
          .catch((err) => {
            // Camera unavailable or start() lost the race — surface it
            // instead of leaving a dead black box with no explanation.
            if (!cancelled) {
              setCameraError(
                err?.name === 'NotAllowedError'
                  ? 'Camera permission was denied. Allow camera access, or enter the code manually below.'
                  : 'Could not start the camera. You can enter the code manually below.'
              );
            }
          });
      })
    );

    return () => {
      cancelled = true;
      scannerLock = scannerLock.then(() => {
        if (runningRef.current) {
          runningRef.current = false;
          return scannerRef.current?.stop().catch(() => {});
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <button onClick={onCancel} style={backLink}>
        ← Cancel
      </button>
      <div className="display" style={{ fontSize: 17, fontWeight: 700, margin: '10px 0 16px' }}>Scan the manhole QR code</div>
      {!cameraDisabled && !cameraError && (
        <div
          id="qr-reader"
          ref={ref}
          style={{
            width: '100%',
            aspectRatio: '1',
            background: '#000',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />
      )}
      {cameraError && (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--status-warning)', padding: 12, borderRadius: 'var(--radius-md)', color: 'var(--status-warning)', fontSize: 13, marginBottom: 14, lineHeight: 1.4 }}>
          {cameraError}
        </div>
      )}
      <ManualEntry onScan={onScan} />
    </div>
  );
}

function ManualEntry({ onScan }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const val = new FormData(e.target).get('code');
        if (val) onScan(String(val), 'manual');
      }}
      style={{ marginTop: 18 }}
    >
      <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginBottom: 8 }}>
        Camera blocked or unavailable? Paste the full scan link from the QR (e.g.{' '}
        <span className="mono">.../scan/&lt;token&gt;</span>) — not the manhole ID printed under it,
        that label alone won't resolve:
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          name="code"
          placeholder="https://.../scan/... or the raw token"
          style={{
            flex: 1,
            minHeight: 'var(--touch-target)',
            padding: '10px 12px',
            border: '1px solid var(--border-hairline)',
            borderRadius: 8,
            background: 'var(--surface-2)',
            color: 'var(--ink-primary)',
            fontSize: 15,
          }}
        />
        <button
          type="submit"
          style={{
            minHeight: 'var(--touch-target)',
            padding: '0 18px',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--ink-primary)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Use
        </button>
      </div>
    </form>
  );
}

const backLink = {
  alignSelf: 'flex-start',
  background: 'transparent',
  border: 'none',
  fontSize: 14,
  minHeight: 44,
  padding: '10px 0',
  color: 'var(--ink-secondary)',
};
