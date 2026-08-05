import Card from './Card';

// label, value, and optional delta ({ value: '+3', good: true }). Value uses
// proportional figures per the dataviz stat-tile spec — no tabular-nums here.
export default function StatTile({ label, value, delta, accentColor }) {
  return (
    <Card padding={18}>
      <div
        className="mono"
        style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 700, color: accentColor || 'var(--ink-primary)' }}>
          {value}
        </div>
        {delta && (
          <div
            className="mono"
            style={{ fontSize: 12.5, fontWeight: 600, color: delta.good ? 'var(--status-good)' : 'var(--status-critical)' }}
          >
            {delta.value}
          </div>
        )}
      </div>
    </Card>
  );
}
