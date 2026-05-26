import { useEffect } from 'preact/hooks'
import { useRouter } from './components/Router'
import { Header } from './components/Header'
import { Breadcrumb } from './components/Breadcrumb'
import { PageWrap } from './components/PageWrap'
import { useFileIndex } from './hooks/useFileIndex'
import { useWebSocket } from './hooks/useWebSocket'
import { HomePage } from './components/HomePage'
import { ProjectDetailPage } from './components/ProjectDetailPage'
import { PlanViewer } from './components/PlanViewer'
import { ThemeCtx, useThemeState, fonts } from './lib/theme'

export function App() {
  const { route, navigate } = useRouter()
  const { index, loading, handleWSEvent, refresh } = useFileIndex()
  const { connected } = useWebSocket(handleWSEvent)
  const themeCtx = useThemeState()
  const { theme } = themeCtx

  useEffect(() => {
    document.documentElement.style.background = theme.bg.base
    document.documentElement.style.colorScheme = theme.isDark ? 'dark' : 'light'
  }, [theme])

  return (
    <ThemeCtx.Provider value={themeCtx}>
      <style>{`
        input::placeholder { color: ${theme.text.muted} !important; }
        ::selection { background: ${theme.accent.glow}; color: ${theme.text.primary}; }
        ::-webkit-scrollbar-thumb { background: ${theme.border.default} !important; }
        ::-webkit-scrollbar-thumb:hover { background: ${theme.border.light} !important; }
      `}</style>
      <div style={{ minHeight: '100vh', background: theme.bg.base, fontFamily: fonts.body, color: theme.text.primary, transition: 'background 0.3s, color 0.3s' }}>
        <Header connected={connected} onLogoClick={() => navigate({ page: 'home' })} onRescanComplete={refresh} />

        <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 32px 64px' }}>
          <Breadcrumb route={route} onNavigate={navigate} />

          {loading && route.page === 'home' && (
            <p style={{ color: theme.text.muted, textAlign: 'center', marginTop: '4rem' }}>Loading projects...</p>
          )}

          {!loading && route.page === 'home' && (
            <PageWrap routeKey="home">
              <HomePage projects={index.projects} files={index.files} onNavigate={navigate} />
            </PageWrap>
          )}

          {route.page === 'project' && route.projectName && (
            <PageWrap routeKey={`project-${route.projectName}`}>
              <ProjectDetailPage
                projectName={route.projectName}
                files={index.files[route.projectName] || []}
                onNavigate={navigate}
              />
            </PageWrap>
          )}

          {route.page === 'viewer' && route.filePath && (
            <PageWrap routeKey={`viewer-${route.filePath}`}>
              <PlanViewer path={route.filePath} projectName={route.projectName} onNavigate={navigate} />
            </PageWrap>
          )}
        </main>
      </div>
    </ThemeCtx.Provider>
  )
}
