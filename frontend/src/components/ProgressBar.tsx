interface Props {
  completed: number
  total: number
}

export function ProgressBar({ completed, total }: Props) {
  const pct = total > 0 ? (completed / total) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' }}>
      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: '#1e293b' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: '3px',
          background: pct === 100 ? '#4ade80' : '#818cf8',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: '#64748b', minWidth: '36px', textAlign: 'right' }}>
        {completed}/{total}
      </span>
    </div>
  )
}
