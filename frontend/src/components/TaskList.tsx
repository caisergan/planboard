import { useState } from 'preact/hooks'
import { useTheme, fonts } from '../lib/theme'
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
    <div style={{ padding: '6px 0' }}>
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          loading={pending.has(task.id)}
          onToggle={() => handleToggle(task)}
        />
      ))}
    </div>
  )
}

function TaskItem({ task, loading, onToggle }: { task: Task; loading: boolean; onToggle: () => void }) {
  const { theme } = useTheme()
  const [hovered, setHovered] = useState(false)
  const [animating, setAnimating] = useState(false)
  const isDone = task.status === 'done'

  const handleClick = () => {
    if (loading) return
    setAnimating(true)
    onToggle()
    setTimeout(() => setAnimating(false), 300)
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
        cursor: loading ? 'default' : 'pointer', transition: 'background 0.15s',
        background: hovered && !loading ? theme.ring.track : 'transparent',
        opacity: loading ? 0.5 : 1,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
        border: isDone ? 'none' : `2px solid ${theme.border.light}`,
        background: isDone ? theme.accent.main : 'transparent',
        display: 'grid', placeItems: 'center',
        transition: 'all 0.2s ease',
        transform: animating ? 'scale(1.2)' : 'scale(1)',
      }}>
        {isDone && (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={theme.checkmark} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span style={{
        fontSize: 14,
        color: isDone ? theme.text.muted : theme.text.primary,
        textDecoration: isDone ? 'line-through' : 'none',
        transition: 'color 0.2s, text-decoration 0.2s',
      }}>{task.text}</span>
      {task.status === 'active' && (
        <span style={{
          fontSize: 10, color: theme.status['in-progress'].text, background: theme.status['in-progress'].bg,
          padding: '2px 6px', borderRadius: 4, fontFamily: fonts.mono, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>ACTIVE</span>
      )}
    </div>
  )
}
