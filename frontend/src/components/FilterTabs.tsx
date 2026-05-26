import { useState } from 'preact/hooks'
import { useTheme, fonts } from '../lib/theme'

interface Tab {
  label: string
  count: number
  value: string
}

interface Props {
  tabs: Tab[]
  active: string
  onChange: (value: string) => void
}

export function FilterTabs({ tabs, active, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
      {tabs.map(tab => (
        <TabPill
          key={tab.value}
          active={tab.value === active}
          label={tab.label}
          count={tab.count}
          onClick={() => onChange(tab.value)}
        />
      ))}
    </div>
  )
}

function TabPill({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  const { theme } = useTheme()
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 500, fontFamily: fonts.body,
        background: active ? theme.accent.dim : hovered ? theme.ring.track : 'transparent',
        color: active ? theme.accent.main : theme.text.secondary,
        transition: 'all 0.15s ease',
      }}
    >
      {label}
      <span style={{
        fontSize: 11, fontFamily: fonts.mono, opacity: 0.7,
        background: active ? theme.accent.main + '22' : theme.ring.track,
        padding: '1px 6px', borderRadius: 4,
      }}>{count}</span>
    </button>
  )
}
