// Status is state, not identity — always the fixed status palette (never a
// categorical series color), always icon + label so it never leans on hue alone.
const STATUS_META = {
  pending: { label: 'Not started', tone: 'neutral', icon: '○' },
  in_progress: { label: 'In progress', tone: 'good', icon: '●' },
  pending_confirmation: { label: 'Awaiting confirmation', tone: 'warning', icon: '◐' },
  unconfirmed: { label: 'Unconfirmed', tone: 'serious', icon: '!' },
  escalated: { label: 'Escalated', tone: 'critical', icon: '▲' },
  closed: { label: 'Closed', tone: 'good', icon: '✓' },
  completed: { label: 'Closed', tone: 'good', icon: '✓' },
};

const TONE_COLOR = {
  neutral: 'var(--ink-muted)',
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  serious: 'var(--status-serious)',
  critical: 'var(--status-critical)',
};

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || 'Unknown', tone: 'neutral', icon: '?' };
  const color = TONE_COLOR[meta.tone];
  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color,
        background: 'var(--surface-2)',
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: '3px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}
