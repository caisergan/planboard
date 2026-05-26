import type { FileMetadata } from '../lib/types'

interface Props {
  projectCount: number
  files: Record<string, FileMetadata[]>
}

interface Kpi {
  label: string
  value: string
  color: string
}

export function KpiCards({ projectCount, files }: Props) {
  const allFiles = Object.values(files).flat()
  const totalFiles = allFiles.length
  const tasksDone = allFiles.reduce((sum, f) => sum + (f.completed_tasks || 0), 0)
  const inProgress = allFiles.filter(f => f.status === 'in-progress').length

  const kpis: Kpi[] = [
    { label: 'Projects', value: String(projectCount), color: '#818cf8' },
    { label: 'Total Files', value: totalFiles.toLocaleString(), color: '#e2e8f0' },
    { label: 'Tasks Done', value: String(tasksDone), color: '#4ade80' },
    { label: 'In Progress', value: String(inProgress), color: '#fbbf24' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '1.5rem' }}>
      {kpis.map(kpi => (
        <div key={kpi.label} style={{
          background: '#1e293b',
          borderRadius: '10px',
          padding: '16px',
          border: '1px solid #334155',
        }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {kpi.label}
          </div>
          <div style={{ fontSize: '1.8rem', color: kpi.color, fontWeight: 700, marginTop: '4px' }}>
            {kpi.value}
          </div>
        </div>
      ))}
    </div>
  )
}
