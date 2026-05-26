interface Props {
  value: string
  onChange: (value: string) => void
}

export function ProjectSearch({ value, onChange }: Props) {
  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '10px 14px',
      marginBottom: '1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <span style={{ color: '#475569', fontSize: '0.85rem' }}>&#128269;</span>
      <input
        type="text"
        placeholder="Search projects..."
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        style={{
          background: 'none',
          border: 'none',
          outline: 'none',
          color: '#e2e8f0',
          fontSize: '0.85rem',
          width: '100%',
        }}
      />
    </div>
  )
}
