import type { FileMetadata } from '../lib/types'
import { ProgressBar } from './ProgressBar'

interface Props {
  name: string
  files: FileMetadata[]
  onClick: () => void
}

export function ProjectCard({ name, files, onClick }: Props) {
  const plans = files.filter(f => f.type === 'plan')
  const specs = files.filter(f => f.type === 'spec')
  const totalTasks = files.reduce((sum, f) => sum + (f.total_tasks || 0), 0)
  const completedTasks = files.reduce((sum, f) => sum + (f.completed_tasks || 0), 0)
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const pctColor = pct >= 75 ? '#4ade80' : pct >= 25 ? '#fbbf24' : '#818cf8'

  const recentTitles = files
    .filter(f => f.title)
    .slice(0, 3)
    .map(f => f.title)
  const overflow = Math.max(0, files.length - 3)

  const countParts: string[] = []
  if (plans.length > 0) countParts.push(`${plans.length} plan${plans.length > 1 ? 's' : ''}`)
  if (specs.length > 0) countParts.push(`${specs.length} spec${specs.length > 1 ? 's' : ''}`)
  if (totalTasks > 0) countParts.push(`${totalTasks} tasks`)

  return (
    <div
      onClick={onClick}
      style={{
        background: '#1e293b',
        borderRadius: '10px',
        padding: '16px',
        border: '1px solid #334155',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#475569')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600 }}>{name}</div>
        {totalTasks > 0 && (
          <span style={{
            fontSize: '0.6rem',
            padding: '2px 6px',
            background: `${pctColor}22`,
            color: pctColor,
            borderRadius: '3px',
            fontWeight: 500,
          }}>
            {pct}%
          </span>
        )}
      </div>

      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '10px' }}>
        {countParts.join(' · ') || `${files.length} files`}
      </div>

      {totalTasks > 0 && <ProgressBar completed={completedTasks} total={totalTasks} />}

      {recentTitles.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
          {recentTitles.map(title => (
            <span key={title} style={{
              fontSize: '0.6rem',
              padding: '1px 5px',
              background: '#818cf822',
              color: '#818cf8',
              borderRadius: '3px',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {title}
            </span>
          ))}
          {overflow > 0 && (
            <span style={{ fontSize: '0.6rem', padding: '1px 5px', background: '#64748b22', color: '#64748b', borderRadius: '3px' }}>
              +{overflow}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
