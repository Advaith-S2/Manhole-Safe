import Card from '../ui/Card';

// >7 classes that all carry meaning -> table, not more colors. Contractor
// count is unbounded in principle, so this stays a table rather than a bar
// chart that would need an ever-growing categorical palette.
export default function ContractorBreakdownTable({ rows }) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);

  return (
    <Card>
      <div className="display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        By contractor
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 16 }}>Work orders and escalations</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>No work orders yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-muted)', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 10px 6px 0', fontWeight: 600 }}>Contractor</th>
                <th style={{ padding: '6px 10px', fontWeight: 600, textAlign: 'right' }}>Work orders</th>
                <th style={{ padding: '6px 0 6px 10px', fontWeight: 600, textAlign: 'right' }}>Escalated / unconfirmed</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.name} style={{ borderTop: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '9px 10px 9px 0', color: 'var(--ink-primary)' }}>{row.name}</td>
                  <td className="mono" style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--ink-secondary)' }}>{row.total}</td>
                  <td
                    className="mono"
                    style={{
                      padding: '9px 0 9px 10px',
                      textAlign: 'right',
                      fontWeight: row.risky > 0 ? 700 : 400,
                      color: row.risky > 0 ? 'var(--status-critical)' : 'var(--ink-muted)',
                    }}
                  >
                    {row.risky}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
