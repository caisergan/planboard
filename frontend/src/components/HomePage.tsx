import { useState } from 'preact/hooks'
import type { FileMetadata, ProjectSummary } from '../lib/types'
import type { Route } from './Router'
import { useTheme } from '../lib/theme'
import { KpiCards } from './KpiCards'
import { ProjectSearch } from './ProjectSearch'
import { ProjectCard } from './ProjectCard'

interface Props {
  projects: ProjectSummary[]
  files: Record<string, FileMetadata[]>
  onNavigate: (route: Route) => void
}

export function HomePage({ projects, files, onNavigate }: Props) {
  const { theme } = useTheme()
  const [search, setSearch] = useState('')

  function latestDate(name: string): string {
    const pFiles = files[name] || []
    let latest = ''
    for (const f of pFiles) {
      const d = f.modified_at || f.created || ''
      if (d > latest) latest = d
    }
    return latest
  }

  const sorted = [...projects].sort((a, b) => latestDate(b.name).localeCompare(latestDate(a.name)))

  const filtered = search
    ? sorted.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : sorted

  return (
    <div>
      <KpiCards projectCount={projects.length} files={files} />
      <ProjectSearch value={search} onChange={setSearch} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {filtered.map(project => (
          <ProjectCard
            key={project.name}
            name={project.name}
            files={files[project.name] || []}
            onClick={() => onNavigate({ page: 'project', projectName: project.name })}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 48, color: theme.text.muted, fontSize: 15 }}>
            {search ? `No projects matching "${search}"` : 'No projects found. Check your config roots.'}
          </div>
        )}
      </div>
    </div>
  )
}
