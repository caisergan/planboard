import type { Route } from './Router'
import { useTheme } from '../lib/theme'
import { ChevronRightIcon } from './Icons'

interface Props {
  route: Route
  onNavigate: (route: Route) => void
}

export function Breadcrumb({ route, onNavigate }: Props) {
  const { theme } = useTheme()

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

  if (segments.length <= 1) return null

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: theme.text.muted, flexWrap: 'wrap', marginBottom: 20 }}>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <ChevronRightIcon style={{ opacity: 0.4 }} />}
            {seg.route && !isLast ? (
              <span
                onClick={() => onNavigate(seg.route!)}
                style={{ color: theme.text.secondary, cursor: 'pointer', transition: 'color 0.15s' }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = theme.text.primary)}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = theme.text.secondary)}
              >
                {seg.label}
              </span>
            ) : (
              <span style={{ color: theme.text.primary, fontWeight: 500 }}>{seg.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
