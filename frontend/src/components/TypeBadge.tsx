import { useTheme, fonts } from '../lib/theme'

interface Props {
  type: string
}

export function TypeBadge({ type }: Props) {
  const { theme } = useTheme()
  const isPlan = type === 'plan'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600,
      padding: '3px 8px', borderRadius: 6,
      background: isPlan ? theme.accent.dim : theme.ring.track,
      color: isPlan ? theme.accent.main : theme.text.secondary,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      fontFamily: fonts.mono,
    }}>
      {type}
    </span>
  )
}
