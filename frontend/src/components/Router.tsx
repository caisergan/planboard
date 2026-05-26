import { useState, useEffect, useCallback } from 'preact/hooks'

export interface Route {
  page: 'home' | 'project' | 'viewer'
  projectName?: string
  filePath?: string
  fileTitle?: string
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.pathname + location.search))

  useEffect(() => {
    function onPopState() {
      setRoute(parseRoute(location.pathname + location.search))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((r: Route) => {
    const url = routeToUrl(r)
    history.pushState(null, '', url)
    setRoute(r)
  }, [])

  return { route, navigate }
}

function parseRoute(url: string): Route {
  const [pathname, search] = url.split('?')
  const params = new URLSearchParams(search || '')

  if (pathname.startsWith('/project/')) {
    const name = decodeURIComponent(pathname.slice('/project/'.length))
    return { page: 'project', projectName: name }
  }

  if (pathname === '/view') {
    const path = params.get('path') || ''
    const project = params.get('project') || ''
    const title = params.get('title') || ''
    return { page: 'viewer', filePath: path, projectName: project, fileTitle: title }
  }

  return { page: 'home' }
}

function routeToUrl(r: Route): string {
  switch (r.page) {
    case 'project':
      return `/project/${encodeURIComponent(r.projectName || '')}`
    case 'viewer':
      return `/view?path=${encodeURIComponent(r.filePath || '')}&project=${encodeURIComponent(r.projectName || '')}&title=${encodeURIComponent(r.fileTitle || '')}`
    default:
      return '/'
  }
}
