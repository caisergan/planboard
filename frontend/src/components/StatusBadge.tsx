interface Props {
  status: string
}

const colors: Record<string, string> = {
  'done': '#4ade80',
  'in-progress': '#fbbf24',
  'pending': '#64748b',
}

export function StatusBadge({ status }: Props) {
  const color = colors[status] || colors.pending
  return (
    <span style={{
      fontSize: '0.65rem',
      padding: '1px 5px',
      borderRadius: '3px',
      background: `${color}22`,
      color: color,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      fontWeight: 500,
    }}>
      {status}
    </span>
  )
}
