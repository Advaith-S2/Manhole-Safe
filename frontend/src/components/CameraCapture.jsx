import { useEffect, useRef, useState } from 'react';

// Live camera capture via getUserMedia + canvas snapshot — not an
// <input type="file" capture="environment">. The file-input `capture` hint
// is not honored consistently across mobile browsers (both iOS Safari and
// Android Chrome can still surface a gallery/photo-library option next to
// the camera), so it doesn't actually guarantee a freshly taken photo.
// Opening the camera stream directly and rendering the frame ourselves
// removes the gallery path entirely — there is no file picker to fall back to.
export default function CameraCapture({ onCapture, onCancel, label = 'photo' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.name === 'NotAllowedError'
              ? 'Camera permission was denied. Allow camera access in your browser settings to continue.'
              : 'Could not access the camera on this device.'
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `${label}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCapture(file, URL.createObjectURL(blob));
      },
      'image/jpeg',
      0.85
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 12px' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
        <p style={{ fontSize: 14, color: 'var(--status-critical)', lineHeight: 1.5, marginBottom: 20 }}>{error}</p>
        <button onClick={onCancel} style={cancelBtnStyle}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '3 / 4',
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {!ready && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13 }}>
            Starting camera…
          </div>
        )}
      </div>
      <button
        onClick={handleCapture}
        disabled={!ready}
        style={{
          width: '100%',
          minHeight: 'var(--touch-target)',
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontWeight: 700,
          fontSize: 15,
          opacity: ready ? 1 : 0.6,
        }}
      >
        Capture photo
      </button>
      <button onClick={onCancel} style={cancelBtnStyle}>
        Cancel
      </button>
    </div>
  );
}

const cancelBtnStyle = {
  width: '100%',
  minHeight: 44,
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--ink-primary)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13.5,
};
