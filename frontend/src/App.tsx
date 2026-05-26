import { useState } from 'preact/hooks'
import type { FileMetadata } from './lib/types'
import { useFileIndex } from './hooks/useFileIndex'
import { useWebSocket } from './hooks/useWebSocket'
import { Sidebar } from './components/Sidebar'
import { PlanViewer } from './components/PlanViewer'
import { MarkdownViewer } from './components/MarkdownViewer'

export function App() {
  const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null)
  const { index, loading, handleWSEvent } = useFileIndex()
  const { connected } = useWebSocket(handleWSEvent)

  const totalFiles = Object.values(index.files).flat().length

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          projects={index.projects}
          files={index.files}
          onFileSelect={setSelectedFile}
          selectedPath={selectedFile?.path || null}
        />
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          {loading && !selectedFile && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: '#64748b' }}>Loading projects...</p>
            </div>
          )}
          {!loading && !selectedFile && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '8px' }}>
              <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Select a file to view</p>
              <p style={{ color: '#475569', fontSize: '0.8rem' }}>
                {index.projects.length} projects &middot; {totalFiles} files indexed
              </p>
            </div>
          )}
          {selectedFile?.format === 'html' && <PlanViewer path={selectedFile.path} />}
          {selectedFile?.format === 'md' && <MarkdownViewer path={selectedFile.path} />}
        </main>
      </div>
      <footer style={{
        padding: '6px 16px',
        background: '#1e293b',
        borderTop: '1px solid #334155',
        fontSize: '0.72rem',
        color: '#64748b',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
      }}>
        <span>{index.projects.length} projects</span>
        <span style={{ color: '#334155' }}>|</span>
        <span>{totalFiles} files</span>
        <span style={{ color: '#334155' }}>|</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: connected ? '#4ade80' : '#ef4444',
          }} />
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </footer>
    </div>
  )
}
