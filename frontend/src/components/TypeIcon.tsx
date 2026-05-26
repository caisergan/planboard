import { useTheme } from '../lib/theme'
import { DocumentIcon, ClipboardIcon } from './Icons'

interface Props {
  type: string
  size?: number
}

export function TypeIcon({ type, size = 36 }: Props) {
  const { theme } = useTheme()
  const isPlan = type === 'plan'
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, display: 'grid', placeItems: 'center',
      background: isPlan ? theme.accent.dim : theme.ring.track,
      color: isPlan ? theme.accent.main : theme.text.secondary, flexShrink: 0,
    }}>
      {isPlan
        ? <DocumentIcon width={size * 0.5} height={size * 0.5} />
        : <ClipboardIcon width={size * 0.5} height={size * 0.5} />}
    </div>
  )
}
