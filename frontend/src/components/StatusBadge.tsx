import { useTheme, fonts } from '../lib/theme'

interface Props {
  status: string
}

export function StatusBadge({ status }: Props) {
  const { theme } = useTheme()
  const c = theme.status[status as keyof typeof theme.status] || theme.status.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600,
      padding: '3px 8px', borderRadius: 6, background: c.bg, color: c.text,
      textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: fonts.mono,
    }}>
      {status.replace('-', ' ')}
    </span>
  )
}
