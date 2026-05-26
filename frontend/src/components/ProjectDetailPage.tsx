import { useState } from 'preact/hooks'
import type { FileMetadata } from '../lib/types'
import type { Route } from './Router'
import { ProgressBar } from './ProgressBar'
import { FilterTabs } from './FilterTabs'
import { FileCard } from './FileCard'

interface Props {
  projectName: string
  files: FileMetadata[]
  onNavigate: (route: Route) => void
}

export function ProjectDetailPage({ projectName, files, onNavigate }: Props) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', color: '#f1f5f9', fontWeight: 600, margin: 0 }}>{projectName}</h2>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            {plans.length} plans · {specs.length} specs · {totalTasks} tasks · {pct}% complete
          </div>
        </div>
        {totalTasks > 0 && (
          <div style={{ width: '120px' }}>
            <ProgressBar completed={completedTasks} total={totalTasks} />
          </div>
        )}
      </div>

      <FilterTabs tabs={tabs} active={filter} onChange={setFilter} />

      {filtered.length === 0 && (
        <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>No files match this filter</p>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '10px',
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
      </div>
    </div>
  )
}
