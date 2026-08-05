import { useEffect, useState } from 'react';

/**
 * Circular "pressure gauge" progress ring used for the one orchestrated
 * animated moment in the system: the escalation timer.
 * elapsedSeconds / thresholdSeconds crossing 1.0 shifts amber -> red.
 */
export default function TimerRing({ elapsedSeconds, thresholdSeconds = 3600, size = 96 }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const listener = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', listener);
    return () => mq.removeEventListener?.('change', listener);
  }, []);

  const ratio = Math.min(elapsedSeconds / thresholdSeconds, 1);
  const overdue = elapsedSeconds >= thresholdSeconds;
  const color = overdue ? 'var(--status-critical)' : 'var(--accent)';

  const h = Math.floor(elapsedSeconds / 3600);
  const m = Math.floor((elapsedSeconds % 3600) / 60);
  const s = Math.floor(elapsedSeconds % 60);
  const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  if (reducedMotion) {
    return (
      <div className="mono" style={{ fontWeight: 600, color, fontSize: 15 }}>
        {label}
      </div>
    );
  }

  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - ratio);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.6s ease' }}
        />
      </svg>
      <div
        className="mono"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size < 80 ? 11 : 13,
          fontWeight: 600,
          color,
        }}
      >
        {label}
      </div>
    </div>
  );
}
