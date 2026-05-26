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
    <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
      {tabs.map(tab => {
        const isActive = tab.value === active
        return (
          <span
            key={tab.value}
            onClick={() => onChange(tab.value)}
            style={{
              fontSize: '0.75rem',
              padding: '4px 12px',
              background: isActive ? '#818cf822' : 'transparent',
              color: isActive ? '#818cf8' : '#64748b',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label} ({tab.count})
          </span>
        )
      })}
    </div>
  )
}
