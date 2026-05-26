export function App() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <aside style={{ width: '280px', borderRight: '1px solid #1e293b', padding: '1rem', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '1.25rem', color: '#818cf8', marginBottom: '1rem' }}>Planboard</h1>
        <p style={{ color: '#64748b' }}>Loading projects...</p>
      </aside>
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <p style={{ color: '#64748b' }}>Select a file to view</p>
      </main>
    </div>
  )
}
