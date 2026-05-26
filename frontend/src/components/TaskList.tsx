import { useState } from 'preact/hooks'
import { toggleTask } from '../lib/api'

interface Task {
  id: string
  text: string
  status: string
}

interface Props {
  tasks: Task[]
  filePath: string
  onToggle: () => void
}

export function TaskList({ tasks, filePath, onToggle }: Props) {
  const [pending, setPending] = useState<Set<string>>(new Set())

  async function handleToggle(task: Task) {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    setPending(prev => new Set(prev).add(task.id))

    try {
      await toggleTask(filePath, task.id, newStatus)
      onToggle()
    } catch (err) {
      console.error('Toggle failed:', err)
    } finally {
      setPending(prev => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
    }
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0' }}>
      {tasks.map(task => (
        <li
          key={task.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 0',
            opacity: pending.has(task.id) ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          <input
            type="checkbox"
            checked={task.status === 'done'}
            onChange={() => handleToggle(task)}
            disabled={pending.has(task.id)}
            style={{ cursor: 'pointer', accentColor: '#818cf8', width: '16px', height: '16px' }}
          />
          <span style={{
            textDecoration: task.status === 'done' ? 'line-through' : 'none',
            color: task.status === 'done' ? '#64748b' : task.status === 'active' ? '#fbbf24' : '#e2e8f0',
            fontSize: '0.9rem',
          }}>
            {task.text}
          </span>
          {task.status === 'active' && (
            <span style={{
              fontSize: '0.6rem',
              color: '#fbbf24',
              background: '#fbbf2415',
              padding: '1px 4px',
              borderRadius: '3px',
              marginLeft: '4px',
            }}>
              ACTIVE
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
