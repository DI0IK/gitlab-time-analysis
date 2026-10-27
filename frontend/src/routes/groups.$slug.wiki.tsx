import { createFileRoute } from '@tanstack/react-router'
import { GroupWikiView } from '@/features/wiki/group-wiki'

export interface WikiSearch {
  target?: string
  page?: string
  rev?: string
}

export const Route = createFileRoute('/groups/$slug/wiki')({
  validateSearch: (search: Record<string, unknown>): WikiSearch => {
    return {
      target: typeof search.target === 'string' ? search.target : undefined,
      page: typeof search.page === 'string' ? search.page : undefined,
      rev: typeof search.rev === 'string' ? search.rev : undefined,
    }
  },
  component: function RouteComponent() {
    const { slug } = Route.useParams()
    return <GroupWikiView key={slug} slug={slug} />
  },
})

