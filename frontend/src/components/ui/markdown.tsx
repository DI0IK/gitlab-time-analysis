import * as React from 'react'
import { marked } from 'marked'

interface MarkdownProps {
  content: string
  inline?: boolean
  className?: string
  onWikiLinkClick?: (slug: string) => void
}

export function Markdown({
  content,
  inline = false,
  className = '',
  onWikiLinkClick,
}: MarkdownProps) {
  const html = React.useMemo(() => {
    if (!content) return ''
    try {
      // 1. Strip YAML frontmatter at start (including empty lines before/after)
      let raw = content.replace(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*/, '')

      // 2. Strip HTML comments (e.g. <!-- TIME-TRACKING-TOOL -->)
      raw = raw.replace(/<!--[\s\S]*?-->/g, '')

      let parsed = marked.parse(raw, {
        gfm: true,
        breaks: true,
        async: false,
      }) as string

      // If onWikiLinkClick is present, route wiki links before rewriting other paths
      parsed = parsed.replace(/<a\s+href="([^"]+)"/g, (_match, href) => {
        const isHttp = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')
        const isGitLabSpecial = href.includes('/-/')

        if (!isHttp && !isGitLabSpecial && onWikiLinkClick && !href.startsWith('#')) {
          const cleanSlug = href.replace(/^\/+/, '').replace(/\.(md|markdown)$/i, '')
          return `<a href="javascript:void(0)" data-wiki-slug="${cleanSlug}" class="wiki-link text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer" `
        }

        const fullHref = href.startsWith('/') ? `https://gitlab.com${href}` : href
        return `<a href="${fullHref}" target="_blank" rel="noopener noreferrer" `
      })

      if (inline) {
        parsed = parsed.replace(/^<p>/, '').replace(/<\/p>\s*$/, '')
      }
      return parsed
    } catch {
      return content
    }
  }, [content, inline, onWikiLinkClick])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('a')
    if (target && onWikiLinkClick) {
      const slug = target.getAttribute('data-wiki-slug')
      if (slug) {
        e.preventDefault()
        e.stopPropagation()
        onWikiLinkClick(slug)
      }
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`max-w-none break-words leading-relaxed text-xs ${
        inline ? 'inline [&>p]:inline' : 'space-y-2'
      } [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-foreground [&_h1]:border-b [&_h1]:border-border/30 [&_h1]:pb-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3.5 [&_h2]:mb-1.5 [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-foreground [&_h4]:text-xs [&_h4]:font-medium [&_h4]:mt-2 [&_h4]:mb-0.5 [&_h4]:text-muted-foreground [&_p]:my-1.5 [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-primary/80 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-0.5 [&_li]:my-0.5 [&_li]:leading-relaxed [&_code]:font-mono [&_code]:bg-muted/70 [&_code]:text-emerald-400 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/40 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-2 [&_table]:border-collapse [&_table]:w-full [&_table]:my-3 [&_table]:text-xs [&_th]:border [&_th]:border-border/60 [&_th]:p-1.5 [&_th]:font-semibold [&_th]:bg-muted/40 [&_th]:text-left [&_td]:border [&_td]:border-border/40 [&_td]:p-1.5 [&_hr]:border-border/40 [&_hr]:my-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:border [&_img]:border-border/40 [&_img]:my-3 [&_img]:shadow-xs [&_img]:bg-card/90 [&_img]:p-1 [&_input[type="checkbox"]]:mr-1.5 [&_input[type="checkbox"]]:accent-primary ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
