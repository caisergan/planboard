export interface FileMetadata {
  title: string
  type: 'plan' | 'spec'
  project: string
  created: string
  status: 'pending' | 'in-progress' | 'done'
  total_tasks: number
  completed_tasks: number
  version: number
  path: string
  format: 'html' | 'md'
  modified_at: string
}

export interface ProjectSummary {
  name: string
  file_count: number
}

export interface FileResult {
  content: string
  format: 'html' | 'md'
  metadata: FileMetadata
}

export interface WSEvent {
  type: 'file-changed' | 'file-added' | 'file-deleted' | 'scan-complete'
  path: string
  project: string
  metadata?: FileMetadata
}
