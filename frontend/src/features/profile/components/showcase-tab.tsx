import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Copy, Check, ExternalLink, Sparkles, Sun, Moon, Image as ImageIcon } from 'lucide-react'

interface ShowcaseTabProps {
  username: string
}

export function ShowcaseTab({ username }: ShowcaseTabProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)
  const [previewTheme, setPreviewTheme] = React.useState<'dark' | 'light'>('dark')

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const renderUrl = `${origin}/api/render/user/${username}`
  const profileUrl = `${origin}/users/${username}`

  const markdownSnippet = `[![${username}'s Trophy](${renderUrl})](${profileUrl})`
  const htmlSnippet = `<a href="${profileUrl}"><img src="${renderUrl}" alt="${username}'s Developer Trophy" /></a>`

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Live SVG Card Preview */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Dynamic Developer Trophy Card
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live SVG card rendered dynamically with real-time level, badges, and effort metrics
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => setPreviewTheme('dark')}
              className={`p-1.5 rounded-md text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer ${
                previewTheme === 'dark'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Dark Canvas Preview"
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewTheme('light')}
              className={`p-1.5 rounded-md text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer ${
                previewTheme === 'light'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Light Canvas Preview"
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Light</span>
            </button>
          </div>
        </div>

        {/* SVG Container */}
        <div
          className={`p-6 rounded-xl border flex items-center justify-center transition-colors min-h-[220px] overflow-x-auto ${
            previewTheme === 'dark'
              ? 'bg-zinc-950/90 border-border/60'
              : 'bg-zinc-100 border-zinc-300'
          }`}
        >
          <img
            src={`/api/render/user/${username}`}
            alt={`${username}'s Trophy Card`}
            className="max-w-full drop-shadow-md rounded-lg"
          />
        </div>

        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>Endpoint: /api/render/user/{username}</span>
          <a
            href={`/api/render/user/${username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Open RAW SVG in tab
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Export Snippets */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          Embed & Share Snippets
        </h3>

        {/* GitHub / GitLab Markdown */}
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                GitHub / GitLab Markdown
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(markdownSnippet, 'md')}
                className="gap-1.5 h-8 text-xs font-mono"
              >
                {copiedKey === 'md' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </Button>
            </div>
            <pre className="p-2.5 rounded-lg bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto select-all">
              {markdownSnippet}
            </pre>
          </CardContent>
        </Card>

        {/* HTML Image Tag */}
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                HTML Embed Tag
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(htmlSnippet, 'html')}
                className="gap-1.5 h-8 text-xs font-mono"
              >
                {copiedKey === 'html' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy HTML</span>
                  </>
                )}
              </Button>
            </div>
            <pre className="p-2.5 rounded-lg bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto select-all">
              {htmlSnippet}
            </pre>
          </CardContent>
        </Card>

        {/* Direct Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Button
            variant="outline"
            className="w-full justify-between h-10 text-xs font-mono"
            onClick={() => handleCopy(profileUrl, 'profile')}
          >
            <span className="truncate pr-2">Copy Profile URL</span>
            {copiedKey === 'profile' ? (
              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0" />
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between h-10 text-xs font-mono"
            onClick={() => handleCopy(renderUrl, 'direct')}
          >
            <span className="truncate pr-2">Copy Direct SVG URL</span>
            {copiedKey === 'direct' ? (
              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
