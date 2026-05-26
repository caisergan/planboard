import { useRouter } from './components/Router'
import { Breadcrumb } from './components/Breadcrumb'
import { useFileIndex } from './hooks/useFileIndex'
import { useWebSocket } from './hooks/useWebSocket'
import { HomePage } from './components/HomePage'
import { ProjectDetailPage } from './components/ProjectDetailPage'
import { PlanViewer } from './components/PlanViewer'

export function App() {
  const { route, navigate } = useRouter()
  const { index, loading, handleWSEvent } = useFileIndex()
  const { connected } = useWebSocket(handleWSEvent)

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Breadcrumb route={route} connected={connected} onNavigate={navigate} />

      {loading && route.page === 'home' && (
        <p style={{ color: '#64748b', textAlign: 'center', marginTop: '4rem' }}>Loading projects...</p>
      )}

      {!loading && route.page === 'home' && (
        <HomePage
          projects={index.projects}
          files={index.files}
          onNavigate={navigate}
        />
      )}

      {route.page === 'project' && route.projectName && (
        <ProjectDetailPage
          projectName={route.projectName}
          files={index.files[route.projectName] || []}
          onNavigate={navigate}
        />
      )}

      {route.page === 'viewer' && route.filePath && (
        <PlanViewer path={route.filePath} />
      )}
    </div>
  )
}
