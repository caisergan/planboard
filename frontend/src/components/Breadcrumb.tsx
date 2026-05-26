import type { Route } from './Router'

interface Props {
  route: Route
  connected: boolean
  onNavigate: (route: Route) => void
}

export function Breadcrumb({ route, connected, onNavigate }: Props) {
  const segments: { label: string; route?: Route }[] = [
    { label: 'Home', route: { page: 'home' } },
  ]

  if (route.page === 'project' && route.projectName) {
    segments.push({ label: route.projectName })
  }

  if (route.page === 'viewer') {
    if (route.projectName) {
      segments.push({
        label: route.projectName,
        route: { page: 'project', projectName: route.projectName },
      })
    }
    segments.push({ label: route.fileTitle || 'Plan' })
  }

  return (
    <div style={{
      fontSize: '0.75rem',
      color: '#64748b',
      marginBottom: '1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {i > 0 && <span style={{ color: '#475569' }}>/</span>}
            {seg.route && !isLast ? (
              <span
                onClick={() => onNavigate(seg.route!)}
                style={{ color: '#818cf8', cursor: 'pointer' }}
              >
                {seg.label}
              </span>
            ) : (
              <span style={{ color: isLast ? '#e2e8f0' : '#818cf8' }}>{seg.label}</span>
            )}
          </span>
        )
      })}
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: connected ? '#4ade80' : '#ef4444',
        }} />
        <span style={{ fontSize: '0.65rem' }}>{connected ? 'Live' : 'Disconnected'}</span>
      </span>
    </div>
  )
}
