import type { FileMetadata, FileResult, ProjectSummary } from './types'

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch('/api/projects')
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`)
  return res.json()
}

export async function fetchProjectFiles(name: string): Promise<FileMetadata[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(name)}/files`)
  if (!res.ok) throw new Error(`Failed to fetch files for ${name}: ${res.status}`)
  return res.json()
}

export async function fetchFile(path: string): Promise<FileResult> {
  const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`)
  return res.json()
}

export async function rescan(): Promise<{ projects: number; files: number }> {
  const res = await fetch('/api/rescan', { method: 'POST' })
  if (!res.ok) throw new Error(`Rescan failed: ${res.status}`)
  return res.json()
}

export async function toggleTask(path: string, taskId: string, status: string): Promise<FileMetadata> {
  const res = await fetch('/api/files/tasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, taskId, status }),
  })
  if (!res.ok) throw new Error(`Failed to toggle task: ${res.status}`)
  return res.json()
}
