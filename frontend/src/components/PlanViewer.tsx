import { useState, useEffect } from 'preact/hooks'
import type { FileResult } from '../lib/types'
import { fetchFile } from '../lib/api'
import { TaskList } from './TaskList'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'

interface Props {
  path: string
}

interface Phase {
  id: string
  title: string
  status: string
  tasks: { id: string; text: string; status: string }[]
}

export function PlanViewer({ path }: Props) {
  const [file, setFile] = useState<FileResult | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setError(null)
      const result = await fetchFile(path)
      setFile(result)
      setPhases(parsePhases(result.content))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    }
  }

  useEffect(() => { load() }, [path])

  if (error) {
    return <p style={{ color: '#ef4444' }}>{error}</p>
  }

  if (!file) {
    return <p style={{ color: '#64748b' }}>Loading...</p>
  }

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0)
  const doneTasks = phases.reduce((sum, p) => sum + p.tasks.filter(t => t.status === 'done').length, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#f1f5f9', fontWeight: 600 }}>{file.metadata.title}</h2>
        {file.metadata.status && <StatusBadge status={file.metadata.status} />}
      </div>

      {file.metadata.project && (
        <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1rem' }}>
          {file.metadata.project} &middot; {file.metadata.created}
        </p>
      )}

      <ProgressBar completed={doneTasks} total={totalTasks} />

      {phases.map(phase => (
        <div key={phase.id} style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#cbd5e1', fontWeight: 500 }}>{phase.title}</h3>
            <StatusBadge status={phase.status} />
          </div>
          <ProgressBar
            completed={phase.tasks.filter(t => t.status === 'done').length}
            total={phase.tasks.length}
          />
          <TaskList tasks={phase.tasks} filePath={path} onToggle={load} />
        </div>
      ))}

      {phases.length === 0 && (
        <div style={{ marginTop: '2rem' }}>
          <p style={{ color: '#64748b' }}>This plan has no phases or tasks defined.</p>
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ color: '#818cf8', cursor: 'pointer', fontSize: '0.85rem' }}>View raw HTML</summary>
            <pre style={{
              marginTop: '0.5rem',
              padding: '1rem',
              background: '#1e293b',
              borderRadius: '8px',
              fontSize: '0.75rem',
              overflow: 'auto',
              maxHeight: '400px',
              color: '#94a3b8',
            }}>
              {file.content}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}

function parsePhases(html: string): Phase[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const phases: Phase[] = []

  doc.querySelectorAll('[data-phase]').forEach(el => {
    const phaseEl = el as HTMLElement
    const tasks: Phase['tasks'] = []

    phaseEl.querySelectorAll('[data-task-id]').forEach(taskEl => {
      const li = taskEl as HTMLElement
      tasks.push({
        id: li.dataset.taskId!,
        text: li.textContent?.trim() || '',
        status: li.dataset.taskStatus || 'pending',
      })
    })

    phases.push({
      id: phaseEl.dataset.phase!,
      title: phaseEl.querySelector('h3')?.textContent || `Phase ${phaseEl.dataset.phase}`,
      status: phaseEl.dataset.phaseStatus || 'pending',
      tasks,
    })
  })

  return phases
}
