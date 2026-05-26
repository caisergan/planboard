import type { FileMetadata } from '../lib/types'
import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'

interface Props {
  file: FileMetadata
  onClick: () => void
}

export function FileCard({ file, onClick }: Props) {
  const icon = file.format === 'html' ? '◆' : '◇'
  const iconColor = file.format === 'html' ? '#818cf8' : '#94a3b8'
  const hasTasks = file.total_tasks > 0

  return (
    <div
      onClick={onClick}
      style={{
        background: '#1e293b',
        borderRadius: '10px',
        padding: '14px',
        border: '1px solid #334155',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#475569')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{ color: iconColor, fontSize: '0.7rem' }}>{icon}</span>
        <span style={{
          fontSize: '0.85rem',
          color: '#f1f5f9',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {file.title || 'Untitled'}
        </span>
      </div>

      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>{file.type || 'file'}</span>
        {file.created && (
          <>
            <span style={{ color: '#475569' }}>·</span>
            <span>{file.created}</span>
          </>
        )}
        {file.status && (
          <>
            <span style={{ color: '#475569' }}>·</span>
            <StatusBadge status={file.status} />
          </>
        )}
      </div>

      {hasTasks && <ProgressBar completed={file.completed_tasks} total={file.total_tasks} />}

      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '6px' }}>
        {hasTasks ? `${file.completed_tasks}/${file.total_tasks} tasks done` : 'design document'}
      </div>
    </div>
  )
}
