import * as React from 'react'
import { marked } from 'marked'

interface MarkdownProps {
  content: string
  inline?: boolean
  className?: string
}

export function Markdown({ content, inline = false, className = '' }: MarkdownProps) {
  const html = React.useMemo(() => {
    if (!content) return ''
    try {
      let parsed = marked.parse(content, {
        gfm: true,
        breaks: true,
        async: false,
      }) as string

      // Convert relative GitLab paths to full GitLab URLs
      parsed = parsed.replace(/href="\/([^"]+)"/g, 'href="https://gitlab.com/$1"')
      // Ensure all links open in a new tab
      parsed = parsed.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')

      if (inline) {
        parsed = parsed.replace(/^<p>/, '').replace(/<\/p>\s*$/, '')
      }
      return parsed
    } catch {
      return content
    }
  }, [content, inline])

  return (
    <div
      className={`max-w-none break-words leading-relaxed text-xs ${
        inline ? 'inline [&>p]:inline' : 'space-y-1.5'
      } [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-2.5 [&_h1]:mb-1 [&_h1]:text-foreground [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-1.5 [&_h3]:mb-0.5 [&_h3]:text-foreground [&_p]:my-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_em]:italic [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-primary/80 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_code]:font-mono [&_code]:bg-muted/70 [&_code]:text-emerald-400 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-muted/50 [&_pre]:p-2.5 [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/40 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-2.5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_table]:border-collapse [&_table]:w-full [&_table]:my-2 [&_table]:text-xs [&_th]:border [&_th]:border-border/60 [&_th]:p-1.5 [&_th]:font-semibold [&_th]:bg-muted/40 [&_td]:border [&_td]:border-border/40 [&_td]:p-1.5 [&_hr]:border-border/40 [&_hr]:my-2 [&_input[type="checkbox"]]:mr-1.5 [&_input[type="checkbox"]]:accent-primary ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
