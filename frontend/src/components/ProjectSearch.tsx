import { useState } from 'preact/hooks'
import { useTheme, fonts } from '../lib/theme'
import { SearchIcon } from './Icons'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function ProjectSearch({ value, onChange }: Props) {
  const { theme } = useTheme()
  const [focused, setFocused] = useState(false)

  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      background: theme.bg.input, borderRadius: 10, marginBottom: 24,
      border: `1px solid ${focused ? theme.accent.main : theme.border.default}`,
      boxShadow: focused ? `0 0 0 3px ${theme.accent.glow}` : 'none',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}>
      <div style={{ position: 'absolute', left: 14, color: theme.text.muted, pointerEvents: 'none', display: 'flex' }}>
        <SearchIcon />
      </div>
      <input
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search projects..."
        style={{
          width: '100%', background: 'transparent', border: 'none', outline: 'none',
          padding: '12px 14px 12px 42px', fontSize: 15, color: theme.text.primary,
          fontFamily: fonts.body,
        }}
      />
      {!value && !focused && (
        <span style={{
          position: 'absolute', right: 14, fontSize: 11, color: theme.text.muted,
          background: theme.ring.track, padding: '2px 6px', borderRadius: 4,
          fontFamily: fonts.mono,
        }}>Cmd+K</span>
      )}
    </div>
  )
}
