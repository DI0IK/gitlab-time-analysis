/**
 * Helper to ensure avatar URLs always have an absolute hostname.
 * Handles GitLab relative uploads like `/uploads/-/system/user/avatar/...`
 */
export function getAvatarUrl(url?: string | null, gitlabDomain = 'https://gitlab.com'): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  const cleanDomain = gitlabDomain.replace(/\/+$/, '')
  const cleanPath = url.startsWith('/') ? url : `/${url}`
  return `${cleanDomain}${cleanPath}`
}

export function generateAvatarUrl(name: string): string {
  const encoded = encodeURIComponent(name.trim() || 'User')
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encoded}`
}

