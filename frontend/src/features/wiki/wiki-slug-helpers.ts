export interface WikiPageSlugItem {
  slug: string
  title?: string
}

/**
 * Resolves a wiki target path (from markdown links or URL parameters)
 * against the current page slug and available pages list.
 */
export function resolveWikiSlug(
  target: string,
  currentSlug: string,
  pages: WikiPageSlugItem[]
): string {
  if (!target) return ''
  try {
    target = decodeURIComponent(target)
  } catch {
    // Keep target as is
  }

  // Strip hash anchor if present
  let clean = target.split('#')[0].trim()
  clean = clean.replace(/^\/+/, '').replace(/\.(md|markdown)$/i, '')
  if (!clean) return currentSlug || ''

  // 1. Direct match (exact or case-insensitive)
  const exact = pages.find((p) => p.slug === clean) ||
    pages.find((p) => p.slug.toLowerCase() === clean.toLowerCase())
  if (exact) return exact.slug

  // 2. Resolve relative path segments against base directory
  const resolveWithBase = (base: string) => {
    const parts = base ? base.split('/') : []
    for (const seg of clean.split('/')) {
      if (!seg || seg === '.') continue
      if (seg === '..') {
        if (parts.length > 0) parts.pop()
      } else {
        parts.push(seg)
      }
    }
    return parts.join('/')
  }

  const parentDir = currentSlug.includes('/')
    ? currentSlug.slice(0, currentSlug.lastIndexOf('/'))
    : ''

  const candidates = [
    resolveWithBase(parentDir),
    resolveWithBase(currentSlug),
    `Home/${clean}`,
    clean.replace(/^Home\//i, ''),
  ]

  for (const cand of candidates) {
    if (!cand) continue
    const match = pages.find((p) => p.slug === cand) ||
      pages.find((p) => p.slug.toLowerCase() === cand.toLowerCase())
    if (match) return match.slug
  }

  // 3. Suffix / filename / title match
  const suffixMatch = pages.find((p) =>
    p.slug.toLowerCase().endsWith(`/${clean.toLowerCase()}`) ||
    p.slug.toLowerCase().split('/').pop() === clean.toLowerCase() ||
    (p.title && p.title.toLowerCase() === clean.toLowerCase())
  )
  if (suffixMatch) return suffixMatch.slug

  // 4. Normalized match (dashes vs underscores)
  const normClean = clean.toLowerCase().replace(/[-_]/g, '')
  const normMatch = pages.find((p) =>
    p.slug.toLowerCase().replace(/[-_]/g, '') === normClean ||
    p.slug.toLowerCase().replace(/[-_]/g, '').endsWith(normClean)
  )
  if (normMatch) return normMatch.slug

  return clean
}
