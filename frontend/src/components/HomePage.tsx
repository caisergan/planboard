import { useState } from 'preact/hooks'
import type { FileMetadata, ProjectSummary } from '../lib/types'
import type { Route } from './Router'
import { KpiCards } from './KpiCards'
import { ProjectSearch } from './ProjectSearch'
import { ProjectCard } from './ProjectCard'

interface Props {
  projects: ProjectSummary[]
  files: Record<string, FileMetadata[]>
  onNavigate: (route: Route) => void
}

export function HomePage({ projects, files, onNavigate }: Props) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects

  return (
    <div>
      <KpiCards projectCount={projects.length} files={files} />
      <ProjectSearch value={search} onChange={setSearch} />

      {filtered.length === 0 && (
        <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>
          {search ? 'No projects match your search' : 'No projects found. Check your config roots.'}
        </p>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '12px',
      }}>
        {filtered.map(project => (
          <ProjectCard
            key={project.name}
            name={project.name}
            files={files[project.name] || []}
            onClick={() => onNavigate({ page: 'project', projectName: project.name })}
          />
        ))}
      </div>
    </div>
  )
}
