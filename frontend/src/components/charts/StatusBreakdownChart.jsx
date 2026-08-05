import Card from '../ui/Card';

// Part-to-whole across permit statuses. Horizontal bar (long category names),
// categorical color assigned in fixed series order — never reused for a
// different status between renders. Direct-labeled since count <= 6.
const STATUS_ORDER = [
  { key: 'pending', label: 'Not started', series: 'var(--series-1)' },
  { key: 'in_progress', label: 'In progress', series: 'var(--series-2)' },
  { key: 'pending_confirmation', label: 'Awaiting confirmation', series: 'var(--series-4)' },
  { key: 'unconfirmed', label: 'Unconfirmed', series: 'var(--series-5)' },
  { key: 'escalated', label: 'Escalated', series: 'var(--series-8)' },
  { key: 'closed', label: 'Closed', series: 'var(--series-3)' },
];

export default function StatusBreakdownChart({ counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = STATUS_ORDER.map((s) => ({ ...s, count: counts[s.key] || 0 }));
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card>
      <div className="display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        Permits by status
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 18 }}>
        {total} total work order{total === 1 ? '' : 's'}
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((row) => (
          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 34px', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>{row.label}</div>
            <div style={{ background: 'var(--surface-3)', borderRadius: 999, height: 10, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(row.count / max) * 100}%`,
                  minWidth: row.count > 0 ? 6 : 0,
                  height: '100%',
                  background: row.series,
                  borderRadius: 999,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, textAlign: 'right', color: 'var(--ink-primary)' }}>
              {row.count}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
