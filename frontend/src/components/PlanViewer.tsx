import { useState, useEffect, useRef } from 'preact/hooks'
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
  const [viewMode, setViewMode] = useState<'document' | 'tasks'>('document')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  async function load() {
    try {
      setError(null)
      const result = await fetchFile(path)
      setFile(result)
      if (result.format === 'html') {
        setPhases(parsePhases(result.content))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    }
  }

  useEffect(() => { load() }, [path])

  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>
  if (!file) return <p style={{ color: '#64748b' }}>Loading...</p>

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0)
  const doneTasks = phases.reduce((sum, p) => sum + p.tasks.filter(t => t.status === 'done').length, 0)
  const hasTasks = totalTasks > 0

  if (file.format === 'md') {
    return <MarkdownContent content={file.content} metadata={file.metadata} />
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#f1f5f9', fontWeight: 600, margin: 0 }}>{file.metadata.title}</h2>
        {file.metadata.status && <StatusBadge status={file.metadata.status} />}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
        {file.metadata.project} · {file.metadata.created}
      </div>

      {hasTasks && <ProgressBar completed={doneTasks} total={totalTasks} />}

      {hasTasks && (
        <div style={{ display: 'flex', gap: '8px', margin: '1rem 0' }}>
          <button
            onClick={() => setViewMode('document')}
            style={{
              padding: '5px 14px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'document' ? '#818cf822' : '#1e293b',
              color: viewMode === 'document' ? '#818cf8' : '#64748b',
            }}
          >
            Document
          </button>
          <button
            onClick={() => setViewMode('tasks')}
            style={{
              padding: '5px 14px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'tasks' ? '#818cf822' : '#1e293b',
              color: viewMode === 'tasks' ? '#818cf8' : '#64748b',
            }}
          >
            Tasks ({doneTasks}/{totalTasks})
          </button>
        </div>
      )}

      {viewMode === 'document' && (
        <div style={{ marginTop: '1rem' }}>
          <iframe
            ref={iframeRef}
            srcDoc={file.content}
            style={{
              width: '100%',
              border: '1px solid #334155',
              borderRadius: '10px',
              background: '#0f172a',
              minHeight: '500px',
            }}
            onLoad={() => {
              if (iframeRef.current) {
                const body = iframeRef.current.contentDocument?.body
                if (body) {
                  iframeRef.current.style.height = body.scrollHeight + 40 + 'px'
                }
              }
            }}
            sandbox="allow-same-origin"
          />

          {hasTasks && (
            <div style={{
              marginTop: '1rem',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              padding: '16px',
            }}>
              <details>
                <summary style={{
                  color: '#818cf8',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginBottom: '8px',
                }}>
                  Task Controls ({doneTasks}/{totalTasks} done)
                </summary>
                <div style={{ marginTop: '8px' }}>
                  {phases.map(phase => (
                    <div key={phase.id} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>{phase.title}</span>
                        <StatusBadge status={phase.status} />
                      </div>
                      <TaskList tasks={phase.tasks} filePath={path} onToggle={load} />
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {viewMode === 'tasks' && (
        <div style={{ marginTop: '0.5rem' }}>
          {phases.map(phase => (
            <div key={phase.id} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '1.05rem', color: '#cbd5e1', fontWeight: 500, margin: 0 }}>{phase.title}</h3>
                <StatusBadge status={phase.status} />
              </div>
              <ProgressBar
                completed={phase.tasks.filter(t => t.status === 'done').length}
                total={phase.tasks.length}
              />
              <TaskList tasks={phase.tasks} filePath={path} onToggle={load} />
            </div>
          ))}
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

import { marked } from 'marked'
import hljs from 'highlight.js'

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang && hljs.getLanguage(lang)) {
        return `<pre><code class="hljs language-${lang}">${hljs.highlight(text, { language: lang }).value}</code></pre>`
      }
      return `<pre><code class="hljs">${hljs.highlightAuto(text).value}</code></pre>`
    },
  },
})

function MarkdownContent({ content, metadata }: { content: string; metadata: any }) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let md = content
    if (md.startsWith('---')) {
      const end = md.indexOf('---', 3)
      if (end !== -1) md = md.slice(end + 3).trim()
    }
    const result = marked(md)
    if (result instanceof Promise) {
      result.then(setHtml)
    } else {
      setHtml(result)
    }
  }, [content])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#f1f5f9', fontWeight: 600, margin: 0 }}>{metadata.title}</h2>
        {metadata.status && <StatusBadge status={metadata.status} />}
        <span style={{ fontSize: '0.65rem', color: '#64748b', padding: '2px 6px', border: '1px solid #334155', borderRadius: '4px' }}>
          READ-ONLY
        </span>
      </div>
      <div
        class="markdown-body"
        style={{ lineHeight: 1.75, color: '#cbd5e1', fontSize: '0.92rem' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{`
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #f1f5f9; margin-top: 1.5em; margin-bottom: 0.5em; }
        .markdown-body h1 { font-size: 1.4rem; } .markdown-body h2 { font-size: 1.2rem; } .markdown-body h3 { font-size: 1.05rem; }
        .markdown-body p { margin-bottom: 0.75em; }
        .markdown-body ul, .markdown-body ol { padding-left: 1.5em; margin-bottom: 0.75em; }
        .markdown-body li { margin-bottom: 0.25em; }
        .markdown-body code { background: #1e293b; padding: 2px 5px; border-radius: 3px; font-size: 0.85em; }
        .markdown-body pre { background: #1e293b; padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1em; }
        .markdown-body pre code { background: none; padding: 0; }
        .markdown-body a { color: #818cf8; }
        .markdown-body blockquote { border-left: 3px solid #334155; padding-left: 1em; color: #94a3b8; margin-bottom: 0.75em; }
      `}</style>
    </div>
  )
}
