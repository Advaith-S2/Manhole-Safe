import Card from '../ui/Card';

// A single ratio against a limit -> meter, not a pie of two slices. Fill
// carries severity (good -> warning -> critical); unfilled track is a
// lighter step of the same neutral ramp.
//
// flaggedPermits: the actual permits behind mismatchCount/missingCount, so a
// small-sample stat (e.g. "100% — 1 of 1") isn't a dead end — the reader can
// see which permit and how far off without leaving the dashboard.
export default function GpsRiskMeter({ mismatchCount, missingCount, totalWithGps, flaggedPermits = [], onSelectPermit }) {
  const atRisk = mismatchCount + missingCount;
  const pct = totalWithGps > 0 ? Math.round((atRisk / totalWithGps) * 100) : 0;
  const color = pct >= 30 ? 'var(--status-critical)' : pct >= 10 ? 'var(--status-warning)' : 'var(--status-good)';

  return (
    <Card>
      <div className="display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        GPS location risk
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 18 }}>
        Share of permits flagged for mismatch or missing GPS
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color }}>{pct}%</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>
          {atRisk} of {totalWithGps} permit{totalWithGps === 1 ? '' : 's'} with GPS data
        </div>
      </div>

      <div style={{ background: 'var(--surface-3)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, minWidth: pct > 0 ? 6 : 0, height: '100%', background: color, borderRadius: 999, transition: 'width 0.3s ease' }} />
      </div>

      <div style={{ display: 'flex', gap: 16, margin: '14px 0', fontSize: 12 }}>
        <LegendDot color="var(--status-serious)" label={`Mismatch: ${mismatchCount}`} />
        <LegendDot color="var(--ink-muted)" label={`Missing: ${missingCount}`} />
      </div>

      {flaggedPermits.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: 10, display: 'grid', gap: 6 }}>
          {flaggedPermits.map((p) => (
            <button
              key={p.workOrderId}
              onClick={() => onSelectPermit?.(p.workOrderId)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 6,
                padding: '7px 10px',
                fontSize: 12,
                color: 'var(--ink-primary)',
                textAlign: 'left',
                cursor: onSelectPermit ? 'pointer' : 'default',
              }}
            >
              <span className="mono">{p.manholeLabel}</span>
              <span style={{ color: p.reason === 'missing' ? 'var(--ink-muted)' : 'var(--status-warning)' }}>
                {p.reason === 'missing' ? 'GPS missing' : `${p.distanceMeters}m off`}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-secondary)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </div>
  );
}
