import { useState } from 'preact/hooks'
import type { FileMetadata } from '../lib/types'
import { useTheme, fonts } from '../lib/theme'
import { TypeIcon } from './TypeIcon'
import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'

interface Props {
  file: FileMetadata
  onClick: () => void
}

export function FileCard({ file, onClick }: Props) {
  const { theme } = useTheme()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? theme.bg.cardHover : theme.bg.card,
        borderRadius: 12, padding: 18, cursor: 'pointer',
        border: `1px solid ${hovered ? theme.accent.main + '44' : theme.border.default}`,
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.1)' : '0 2px 6px rgba(0,0,0,0.04)',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <TypeIcon type={file.type || 'plan'} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: theme.text.primary, marginBottom: 6,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{file.title || 'Untitled'}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {file.status && <StatusBadge status={file.status} />}
            <span style={{ fontSize: 11, color: theme.text.muted, fontFamily: fonts.mono }}>
              .{file.format}
            </span>
          </div>
        </div>
      </div>

      {file.total_tasks > 0 && (
        <ProgressBar completed={file.completed_tasks} total={file.total_tasks} height={3} />
      )}
    </div>
  )
}
