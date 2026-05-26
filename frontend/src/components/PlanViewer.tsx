import { useState, useEffect, useRef } from 'preact/hooks'
import type { FileResult } from '../lib/types'
import type { Route } from './Router'
import { fetchFile } from '../lib/api'
import { useTheme, fonts } from '../lib/theme'
import { TaskList } from './TaskList'
import { ProgressBar } from './ProgressBar'
import { StatusBadge } from './StatusBadge'
import { TypeIcon } from './TypeIcon'
import { TypeBadge } from './TypeBadge'
import { CheckCircleIcon } from './Icons'

interface Props {
  path: string
  projectName?: string
  onNavigate?: (route: Route) => void
}

interface Phase {
  id: string
  title: string
  status: string
  tasks: { id: string; text: string; status: string }[]
}

export function PlanViewer({ path }: Props) {
  const { theme } = useTheme()
  const [file, setFile] = useState<FileResult | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'document' | 'tasks'>('document')

  async function load() {
    try {
      setError(null)
      setViewMode('document')
      setPhases([])
      const result = await fetchFile(path)
      setFile(result)
      if (result.format === 'html') {
        const parsed = parsePhases(result.content)
        setPhases(parsed)
        const hasParsedTasks = parsed.reduce((s, p) => s + p.tasks.length, 0) > 0
        if (hasParsedTasks) setViewMode('tasks')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    }
  }

  useEffect(() => { load() }, [path])

  if (error) return <p style={{ color: '#f87171', padding: 20 }}>{error}</p>
  if (!file) return <p style={{ color: theme.text.muted, textAlign: 'center', marginTop: '4rem' }}>Loading...</p>

  const totalTasks = phases.reduce((sum, p) => sum + p.tasks.length, 0)
  const doneTasks = phases.reduce((sum, p) => sum + p.tasks.filter(t => t.status === 'done').length, 0)
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const hasTasks = totalTasks > 0

  if (file.format === 'md') {
    return <MarkdownContent content={file.content} metadata={file.metadata} />
  }

  return (
    <div>
      <div style={{
        background: theme.bg.card, borderRadius: 14, padding: '22px 26px',
        border: `1px solid ${theme.border.default}`, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <TypeIcon type={file.metadata.type || 'plan'} size={44} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.text.primary, margin: 0 }}>{file.metadata.title}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {file.metadata.status && <StatusBadge status={file.metadata.status} />}
              {file.metadata.type && <TypeBadge type={file.metadata.type} />}
              <span style={{ fontSize: 12, color: theme.text.muted, fontFamily: fonts.mono }}>
                {file.metadata.format.toUpperCase()} · {file.metadata.created}
              </span>
            </div>
          </div>
          {hasTasks && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: theme.accent.main, fontFamily: fonts.mono, lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 11, color: theme.text.muted, marginTop: 2 }}>COMPLETE</div>
            </div>
          )}
        </div>
        {hasTasks && (
          <div style={{ marginTop: 16 }}>
            <ProgressBar completed={doneTasks} total={totalTasks} height={4} showLabel={false} />
          </div>
        )}
      </div>

      {hasTasks && (
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20,
          background: theme.bg.card, borderRadius: 10, padding: 4,
          width: 'fit-content', border: `1px solid ${theme.border.default}`,
        }}>
          {(['document', 'tasks'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '8px 20px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: fonts.body,
                background: viewMode === mode ? theme.accent.dim : 'transparent',
                color: viewMode === mode ? theme.accent.main : theme.text.secondary,
                transition: 'all 0.15s ease',
              }}
            >
              {mode === 'document' ? 'Document' : 'Tasks'}
            </button>
          ))}
        </div>
      )}

      {viewMode === 'document' && <DocumentView html={file.content} />}
      {viewMode === 'tasks' && hasTasks && <TasksView phases={phases} filePath={path} onToggle={load} />}
    </div>
  )
}

function DocumentView({ html }: { html: string }) {
  const { theme } = useTheme()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  return (
    <div style={{
      background: theme.bg.card, borderRadius: 14,
      border: `1px solid ${theme.border.default}`, overflow: 'hidden',
    }}>
      <iframe
        ref={iframeRef}
        srcDoc={html}
        style={{ width: '100%', border: 'none', background: theme.bg.base, minHeight: 500, display: 'block' }}
        onLoad={() => {
          if (iframeRef.current) {
            const body = iframeRef.current.contentDocument?.body
            if (body) iframeRef.current.style.height = body.scrollHeight + 40 + 'px'
          }
        }}
        sandbox="allow-same-origin"
      />
    </div>
  )
}

function TasksView({ phases, filePath, onToggle }: { phases: Phase[]; filePath: string; onToggle: () => void }) {
  const { theme } = useTheme()
  const totalDone = phases.reduce((s, p) => s + p.tasks.filter(i => i.status === 'done').length, 0)
  const totalAll = phases.reduce((s, p) => s + p.tasks.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        background: theme.accent.dim, borderRadius: 10, fontSize: 14, color: theme.accent.text,
        fontFamily: fonts.mono,
      }}>
        <CheckCircleIcon width={16} height={16} style={{ color: theme.accent.main }} />
        {totalDone} of {totalAll} tasks completed
      </div>

      {phases.map(ph => {
        const phaseDone = ph.tasks.filter(t => t.status === 'done').length
        return (
          <div key={ph.id} style={{
            background: theme.bg.card, borderRadius: 14,
            border: `1px solid ${theme.border.default}`, overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${theme.border.default}`,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: theme.text.primary }}>{ph.title}</span>
              <span style={{ fontSize: 12, color: theme.text.muted, fontFamily: fonts.mono }}>
                {phaseDone}/{ph.tasks.length}
              </span>
            </div>
            <TaskList tasks={ph.tasks} filePath={filePath} onToggle={onToggle} />
          </div>
        )
      })}
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
  const { theme } = useTheme()
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

  const codeBg = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'

  return (
    <div>
      <div style={{
        background: theme.bg.card, borderRadius: 14, padding: '22px 26px',
        border: `1px solid ${theme.border.default}`, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <TypeIcon type={metadata.type || 'spec'} size={44} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.text.primary, margin: 0 }}>{metadata.title}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {metadata.status && <StatusBadge status={metadata.status} />}
              <span style={{
                fontSize: 11, color: theme.text.muted, padding: '3px 8px',
                border: `1px solid ${theme.border.default}`, borderRadius: 6,
                fontFamily: fonts.mono, textTransform: 'uppercase',
              }}>READ-ONLY</span>
            </div>
          </div>
        </div>
      </div>
      <div style={{
        background: theme.bg.card, borderRadius: 14, padding: '32px 36px',
        border: `1px solid ${theme.border.default}`,
      }}>
        <div
          class="markdown-body"
          style={{ lineHeight: 1.75, color: theme.text.secondary, fontSize: '0.92rem' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <style>{`
          .markdown-body h1, .markdown-body h2, .markdown-body h3 { color: ${theme.text.primary}; margin-top: 1.5em; margin-bottom: 0.5em; }
          .markdown-body h1 { font-size: 1.4rem; } .markdown-body h2 { font-size: 1.2rem; } .markdown-body h3 { font-size: 1.05rem; }
          .markdown-body h2 { padding-bottom: 8px; border-bottom: 1px solid ${theme.border.default}; }
          .markdown-body p { margin-bottom: 0.75em; }
          .markdown-body ul, .markdown-body ol { padding-left: 1.5em; margin-bottom: 0.75em; }
          .markdown-body li { margin-bottom: 0.25em; }
          .markdown-body code { font-family: ${fonts.mono}; background: ${codeBg}; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; color: ${theme.accent.text}; }
          .markdown-body pre { background: ${theme.bg.surface}; border: 1px solid ${theme.border.default}; padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1em; }
          .markdown-body pre code { background: none; padding: 0; }
          .markdown-body a { color: ${theme.accent.text}; }
          .markdown-body blockquote { border-left: 3px solid ${theme.border.light}; padding-left: 1em; color: ${theme.text.muted}; margin-bottom: 0.75em; }
          .markdown-body strong { color: ${theme.text.primary}; }
        `}</style>
      </div>
    </div>
  )
}
