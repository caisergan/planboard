import { useState } from 'preact/hooks'
import type { FileMetadata, ProjectSummary } from '../lib/types'
import { StatusBadge } from './StatusBadge'

interface Props {
  projects: ProjectSummary[]
  files: Record<string, FileMetadata[]>
  onFileSelect: (file: FileMetadata) => void
  selectedPath: string | null
}

export function Sidebar({ projects, files, onFileSelect, selectedPath }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function toggle(name: string) {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <aside style={{
      width: '280px',
      minWidth: '280px',
      borderRight: '1px solid #1e293b',
      padding: '1rem',
      overflowY: 'auto',
      height: '100vh',
    }}>
      <h1 style={{ fontSize: '1.25rem', color: '#818cf8', marginBottom: '1.25rem', fontWeight: 600 }}>
        Planboard
      </h1>

      {projects.length === 0 && (
        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No projects found</p>
      )}

      {projects.map(project => (
        <div key={project.name} style={{ marginBottom: '4px' }}>
          <div
            onClick={() => toggle(project.name)}
            style={{
              cursor: 'pointer',
              padding: '5px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '4px',
              userSelect: 'none',
            }}
          >
            <span style={{ color: '#64748b', fontSize: '0.7rem', width: '12px' }}>
              {expanded[project.name] ? '▼' : '▶'}
            </span>
            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{project.name}</span>
            <span style={{ color: '#475569', fontSize: '0.7rem', marginLeft: 'auto' }}>
              {project.file_count}
            </span>
          </div>

          {expanded[project.name] && files[project.name]?.map(file => (
            <div
              key={file.path}
              onClick={() => onFileSelect(file)}
              style={{
                padding: '4px 8px 4px 28px',
                cursor: 'pointer',
                borderRadius: '4px',
                background: selectedPath === file.path ? '#1e293b' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                marginBottom: '1px',
              }}
            >
              <span style={{
                color: file.format === 'html' ? '#818cf8' : '#94a3b8',
                fontSize: '0.7rem',
              }}>
                {file.format === 'html' ? '◆' : '◇'}
              </span>
              <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: selectedPath === file.path ? '#f1f5f9' : '#cbd5e1',
              }}>
                {file.title || 'Untitled'}
              </span>
              {file.status && <StatusBadge status={file.status} />}
            </div>
          ))}
        </div>
      ))}
    </aside>
  )
}
