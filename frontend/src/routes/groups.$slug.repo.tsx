import { createFileRoute } from '@tanstack/react-router'
import { RepoBrowserView } from '@/features/repo/browser'

export interface RepoSearch {
  project?: string
  ref?: string
  path?: string
  view?: 'code' | 'commits'
  line?: string
}

export const Route = createFileRoute('/groups/$slug/repo')({
  validateSearch: (search: Record<string, unknown>): RepoSearch => {
    return {
      project: typeof search.project === 'string' ? search.project : undefined,
      ref: typeof search.ref === 'string' ? search.ref : undefined,
      path: typeof search.path === 'string' ? search.path : undefined,
      view: search.view === 'commits' ? 'commits' : 'code',
      line: typeof search.line === 'string' ? search.line : undefined,
    }
  },
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <RepoBrowserView key={slug} slug={slug} />
  },
})

