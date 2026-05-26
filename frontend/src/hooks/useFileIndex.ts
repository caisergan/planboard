import { useState, useEffect, useCallback } from 'preact/hooks'
import type { FileMetadata, ProjectSummary, WSEvent } from '../lib/types'
import { fetchProjects, fetchProjectFiles } from '../lib/api'

interface FileIndex {
  projects: ProjectSummary[]
  files: Record<string, FileMetadata[]>
}

export function useFileIndex() {
  const [index, setIndex] = useState<FileIndex>({ projects: [], files: {} })
  const [loading, setLoading] = useState(true)

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      const projects = await fetchProjects()
      const files: Record<string, FileMetadata[]> = {}

      for (const project of projects) {
        files[project.name] = await fetchProjectFiles(project.name)
      }

      setIndex({ projects, files })
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleWSEvent = useCallback((event: WSEvent) => {
    if (event.type === 'file-changed' || event.type === 'file-added' || event.type === 'file-deleted') {
      loadProjects()
    }
  }, [loadProjects])

  return { index, loading, handleWSEvent, refresh: loadProjects }
}
