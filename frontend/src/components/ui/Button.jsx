const VARIANTS = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--accent-ink)',
    border: '1px solid var(--accent)',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--ink-primary)',
    border: '1px solid var(--border-strong)',
  },
  danger: {
    background: 'transparent',
    color: 'var(--status-critical)',
    border: '1px solid var(--status-critical)',
  },
};

// Every button in the app renders through here so size/radius/disabled state
// stay identical across Admin, Supervisor, and Contractor surfaces.
export default function Button({
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  size = 'md',
  type = 'button',
  onClick,
  children,
  style,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary;
  const padding = size === 'lg' ? '14px 20px' : size === 'sm' ? '7px 12px' : '11px 18px';
  const fontSize = size === 'lg' ? 15 : size === 'sm' ? 12.5 : 13.5;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? '100%' : undefined,
        padding,
        fontSize,
        fontWeight: 700,
        borderRadius: 'var(--radius-md)',
        opacity: disabled ? 0.55 : 1,
        transition: 'opacity 0.15s ease',
        minHeight: size === 'lg' ? 'var(--touch-target)' : undefined,
        ...palette,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
