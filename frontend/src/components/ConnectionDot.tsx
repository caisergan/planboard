interface Props {
  connected: boolean
}

export function ConnectionDot({ connected }: Props) {
  const color = connected ? '#4ade80' : '#f87171'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#fff' }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
        boxShadow: connected ? '0 0 8px rgba(74,222,128,0.5)' : 'none',
        animation: connected ? 'connPulse 2.5s ease-in-out infinite' : 'none',
      }} />
      <span style={{ color }}>{connected ? 'Connected' : 'Disconnected'}</span>
    </span>
  )
}
