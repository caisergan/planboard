import { useState, useEffect } from 'preact/hooks'
import { useTheme, fonts } from '../lib/theme'

interface Props {
  completed: number
  total: number
  height?: number
  showLabel?: boolean
}

export function ProgressBar({ completed, total, height = 3, showLabel = true }: Props) {
  const { theme } = useTheme()
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => setWidth(pct), 80)
    return () => clearTimeout(id)
  }, [pct])

  return (
    <div>
      <div style={{ height, borderRadius: height, background: theme.ring.track, overflow: 'hidden', width: '100%' }}>
        <div style={{
          height: '100%', borderRadius: height,
          background: pct === 100 ? theme.status.done.text : theme.accent.main,
          width: `${width}%`,
          transition: 'width 0.8s ease-out',
        }} />
      </div>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: theme.text.muted, fontFamily: fonts.mono }}>
          <span>{completed} / {total} tasks</span>
          <span style={{ color: theme.accent.text }}>{pct}%</span>
        </div>
      )}
    </div>
  )
}
