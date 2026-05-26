import { useState, useEffect } from 'preact/hooks'
import { marked } from 'marked'
import hljs from 'highlight.js'
import { fetchFile } from '../lib/api'
import { StatusBadge } from './StatusBadge'

interface Props {
  path: string
}

marked.use({
  renderer: {
    code({ text, lang }) {
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(text, { language: lang }).value
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`
      }
      const highlighted = hljs.highlightAuto(text).value
      return `<pre><code class="hljs">${highlighted}</code></pre>`
    },
  },
})

export function MarkdownViewer({ path }: Props) {
  const [html, setHtml] = useState('')
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setError(null)
        const result = await fetchFile(path)
        setTitle(result.metadata.title)
        setStatus(result.metadata.status)

        let content = result.content
        if (content.startsWith('---')) {
          const end = content.indexOf('---', 3)
          if (end !== -1) {
            content = content.slice(end + 3).trim()
          }
        }

        const rendered = await marked(content)
        setHtml(rendered)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
      }
    }
    load()
  }, [path])

  if (error) {
    return <p style={{ color: '#ef4444' }}>{error}</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#f1f5f9', fontWeight: 600 }}>{title}</h2>
        {status && <StatusBadge status={status} />}
        <span style={{
          fontSize: '0.65rem',
          color: '#64748b',
          padding: '2px 6px',
          border: '1px solid #334155',
          borderRadius: '4px',
        }}>
          READ-ONLY
        </span>
      </div>
      <div
        class="markdown-body"
        style={{
          lineHeight: 1.75,
          color: '#cbd5e1',
          fontSize: '0.92rem',
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style>{`
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #f1f5f9; margin-top: 1.5em; margin-bottom: 0.5em; }
        .markdown-body h1 { font-size: 1.4rem; }
        .markdown-body h2 { font-size: 1.2rem; }
        .markdown-body h3 { font-size: 1.05rem; }
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
