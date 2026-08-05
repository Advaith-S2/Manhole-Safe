import Card from '../ui/Card';

// Trend over time -> line, single series -> sequential/accent hue, no legend
// box needed (title already names the one series). Falls back to a stat-only
// view when there isn't enough closed-permit history for a trend to mean
// anything, rather than rendering a misleading single-point line.
export default function CloseTimeTrend({ points }) {
  const withData = points.filter((p) => p.avgMinutes != null);

  if (withData.length < 2) {
    return (
      <Card>
        <div className="display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Average close time
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 18 }}>Entry to exit-confirmed, by day</div>
        <div style={{ fontSize: 13, color: 'var(--ink-secondary)', padding: '20px 0' }}>
          {withData.length === 1
            ? `${Math.round(withData[0].avgMinutes)} min avg — not enough closed permits yet for a trend.`
            : 'Not enough closed permits yet to show a trend.'}
        </div>
      </Card>
    );
  }

  const width = 520;
  const height = 160;
  const padding = { top: 12, right: 12, bottom: 24, left: 36 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxY = Math.max(...withData.map((p) => p.avgMinutes)) * 1.15 || 1;
  const stepX = plotW / (withData.length - 1);

  const coords = withData.map((p, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + plotH - (p.avgMinutes / maxY) * plotH,
    ...p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${padding.top + plotH} L ${coords[0].x} ${padding.top + plotH} Z`;

  const last = coords[coords.length - 1];

  return (
    <Card>
      <div className="display" style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
        Average close time
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 10 }}>Entry to exit-confirmed, by day (minutes)</div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Average close time trend">
        <line x1={padding.left} y1={padding.top + plotH} x2={width - padding.right} y2={padding.top + plotH} stroke="var(--surface-3)" strokeWidth="1" />
        <path d={areaPath} fill="var(--sequential-500)" opacity="0.1" />
        <path d={linePath} fill="none" stroke="var(--sequential-500)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c) => (
          <circle key={c.date} cx={c.x} cy={c.y} r="4" fill="var(--sequential-500)" stroke="var(--surface-1)" strokeWidth="2" />
        ))}
        <text x={last.x} y={last.y - 10} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--ink-primary)" fontFamily="var(--font-mono)">
          {Math.round(last.avgMinutes)}m
        </text>
        {coords.map((c, i) => (
          (i === 0 || i === coords.length - 1) && (
            <text key={c.date} x={c.x} y={height - 6} textAnchor={i === 0 ? 'start' : 'end'} fontSize="10" fill="var(--ink-muted)">
              {c.date}
            </text>
          )
        ))}
      </svg>
    </Card>
  );
}
