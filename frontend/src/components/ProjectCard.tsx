import { useState } from 'preact/hooks'
import type { FileMetadata } from '../lib/types'
import { useTheme, fonts } from '../lib/theme'
import { ProgressRing } from './ProgressRing'
import { ProgressBar } from './ProgressBar'
import { TypeBadge } from './TypeBadge'

interface Props {
  name: string
  files: FileMetadata[]
  onClick: () => void
}

export function ProjectCard({ name, files, onClick }: Props) {
  const { theme } = useTheme()
  const [hovered, setHovered] = useState(false)

  const plans = files.filter(f => f.type === 'plan').length
  const specs = files.filter(f => f.type === 'spec').length
  const totalTasks = files.reduce((sum, f) => sum + (f.total_tasks || 0), 0)
  const completedTasks = files.reduce((sum, f) => sum + (f.completed_tasks || 0), 0)
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const description = [
    plans > 0 ? `${plans} plan${plans > 1 ? 's' : ''}` : '',
    specs > 0 ? `${specs} spec${specs > 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' · ') || `${files.length} files`

  const dates = files.map(f => f.modified_at || f.created).filter(Boolean).sort()
  const lastModified = dates.length > 0 ? dates[dates.length - 1] : ''

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? theme.bg.cardHover : theme.bg.card,
        borderRadius: 14, padding: 22, cursor: 'pointer',
        border: `1px solid ${hovered ? theme.accent.main + '44' : theme.border.default}`,
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        {totalTasks > 0 && <ProgressRing percentage={pct} size={58} strokeWidth={4} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 600, color: theme.text.primary,
            marginBottom: 4, fontFamily: fonts.mono,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{name}</div>
          <div style={{ fontSize: 13, color: theme.text.muted, lineHeight: 1.4 }}>
            {description}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: theme.text.secondary, fontFamily: fonts.mono }}>
          {files.length} file{files.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {plans > 0 && <TypeBadge type="plan" />}
          {specs > 0 && <TypeBadge type="spec" />}
        </div>
      </div>

      {totalTasks > 0 && (
        <div style={{ marginTop: 14 }}>
          <ProgressBar completed={completedTasks} total={totalTasks} height={3} showLabel={false} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: theme.text.muted, fontFamily: fonts.mono }}>
            <span>{completedTasks} / {totalTasks} tasks</span>
            {lastModified && <span>{lastModified}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
