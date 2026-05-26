import { ComponentChildren } from 'preact'
import type { FileMetadata } from '../lib/types'
import { useTheme, fonts } from '../lib/theme'
import { AnimatedNumber } from './AnimatedNumber'
import { FolderIcon, DocumentIcon, CheckCircleIcon, ClockIcon } from './Icons'

interface Props {
  projectCount: number
  files: Record<string, FileMetadata[]>
}

export function KpiCards({ projectCount, files }: Props) {
  const allFiles = Object.values(files).flat()
  const totalFiles = allFiles.length
  const tasksDone = allFiles.reduce((sum, f) => sum + (f.completed_tasks || 0), 0)
  const inProgress = allFiles.filter(f => f.status === 'in-progress').length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
      <StatCard icon={<FolderIcon width={20} height={20} />} value={projectCount} label="Projects" />
      <StatCard icon={<DocumentIcon width={20} height={20} />} value={totalFiles} label="Total Files" />
      <StatCard icon={<CheckCircleIcon width={20} height={20} />} value={tasksDone} label="Tasks Done" />
      <StatCard icon={<ClockIcon width={20} height={20} />} value={inProgress} label="In Progress" />
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: ComponentChildren; value: number; label: string }) {
  const { theme } = useTheme()
  return (
    <div style={{
      background: theme.bg.card, borderRadius: 12, padding: '20px 22px',
      display: 'flex', alignItems: 'center', gap: 16,
      border: `1px solid ${theme.border.default}`, transition: 'border-color 0.2s',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, display: 'grid', placeItems: 'center',
        background: theme.accent.dim, color: theme.accent.main, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: theme.text.primary, lineHeight: 1.1, fontFamily: fonts.mono }}>
          <AnimatedNumber value={value} />
        </div>
        <div style={{ fontSize: 13, color: theme.text.muted, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}
