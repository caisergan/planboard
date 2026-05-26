import { useState } from 'preact/hooks'
import type { FileMetadata } from '../lib/types'
import type { Route } from './Router'
import { useTheme, fonts } from '../lib/theme'
import { FilterTabs } from './FilterTabs'
import { FileCard } from './FileCard'

interface Props {
  projectName: string
  files: FileMetadata[]
  onNavigate: (route: Route) => void
}

export function ProjectDetailPage({ projectName, files, onNavigate }: Props) {
  const { theme } = useTheme()
  const [filter, setFilter] = useState('all')

  const plans = files.filter(f => f.type === 'plan')
  const specs = files.filter(f => f.type === 'spec')
  const inProgress = files.filter(f => f.status === 'in-progress')
  const done = files.filter(f => f.status === 'done')

  const totalTasks = files.reduce((sum, f) => sum + (f.total_tasks || 0), 0)
  const completedTasks = files.reduce((sum, f) => sum + (f.completed_tasks || 0), 0)
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const tabs = [
    { label: 'All', count: files.length, value: 'all' },
    { label: 'Plans', count: plans.length, value: 'plans' },
    { label: 'Specs', count: specs.length, value: 'specs' },
    { label: 'In Progress', count: inProgress.length, value: 'in-progress' },
    { label: 'Done', count: done.length, value: 'done' },
  ]

  let filtered = files
  switch (filter) {
    case 'plans': filtered = plans; break
    case 'specs': filtered = specs; break
    case 'in-progress': filtered = inProgress; break
    case 'done': filtered = done; break
  }

  return (
    <div>
      <div style={{
        background: theme.bg.card, borderRadius: 14, padding: '24px 28px',
        border: `1px solid ${theme.border.default}`, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.text.primary, margin: 0, fontFamily: fonts.mono }}>
              {projectName}
            </h1>
            <p style={{ fontSize: 14, color: theme.text.muted, margin: '6px 0 0' }}>
              {plans.length} plans · {specs.length} specs
            </p>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <MiniStat label="Plans" value={String(plans.length)} />
            <MiniStat label="Specs" value={String(specs.length)} />
            <MiniStat label="Tasks" value={`${completedTasks}/${totalTasks}`} />
            <MiniStat label="Complete" value={`${pct}%`} />
          </div>
        </div>
      </div>

      <FilterTabs tabs={tabs} active={filter} onChange={setFilter} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 14,
      }}>
        {filtered.map(file => (
          <FileCard
            key={file.path}
            file={file}
            onClick={() => onNavigate({
              page: 'viewer',
              filePath: file.path,
              projectName: projectName,
              fileTitle: file.title,
            })}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: theme.text.muted, fontSize: 14 }}>
            No files match this filter
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme()
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: theme.text.primary, fontFamily: fonts.mono, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: theme.text.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  )
}
