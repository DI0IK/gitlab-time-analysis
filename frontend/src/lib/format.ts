export function formatSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0h'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`
  }
  if (hours > 0) {
    return `${hours}h`
  }
  return `${minutes}m`
}

export function formatHours(hours: number): string {
  if (!hours || hours <= 0) return '0h'
  return `${hours.toFixed(1).replace(/\.0$/, '')}h`
}

export function formatDate(dateStr: string | Date): string {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  if (Number.isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export interface UserDisplayIdentifiable {
  username: string
  name?: string | null
  customDisplayName?: string | null
}

export function resolveDisplayName(user: UserDisplayIdentifiable): string {
  if (user.customDisplayName && user.customDisplayName.trim().length > 0) {
    return user.customDisplayName.trim()
  }
  if (user.name && user.name.trim().length > 0) {
    return user.name.trim()
  }
  return `@${user.username}`
}

export function getRelativePath(path?: string | null, parentSlug?: string): string {
  if (!path) return '/'
  if (!parentSlug) return path
  const cleanPath = path.trim().replace(/^\/+|\/+$/g, '')
  const cleanSlug = parentSlug.trim().replace(/^\/+|\/+$/g, '').toLowerCase()
  const parts = cleanPath.split('/').filter(Boolean)

  for (let len = parts.length; len >= 1; len--) {
    for (let start = 0; start <= parts.length - len; start++) {
      const sub = parts.slice(start, start + len)
      const candHyphen = sub.join('-').toLowerCase()
      const candSlash = sub.join('/').toLowerCase()
      if (candHyphen === cleanSlug || candSlash === cleanSlug) {
        const remaining = parts.slice(start + len)
        return remaining.length > 0 ? remaining.join('/') : '/'
      }
    }
  }

  const normSlug = cleanSlug.replace(/[^a-z0-9]/g, '')
  for (let len = parts.length; len >= 1; len--) {
    for (let start = 0; start <= parts.length - len; start++) {
      const sub = parts.slice(start, start + len)
      const normSub = sub.join('').toLowerCase().replace(/[^a-z0-9]/g, '')
      if (normSub === normSlug) {
        const remaining = parts.slice(start + len)
        return remaining.length > 0 ? remaining.join('/') : '/'
      }
    }
  }

  return cleanPath
}

export function formatStatus(state?: string | null): string {
  const s = (state || '').toLowerCase()
  if (s === 'open' || s === 'opened') return 'Open'
  if (s === 'closed') return 'Closed'
  if (s === 'merged') return 'Merged'
  return state || ''
}

