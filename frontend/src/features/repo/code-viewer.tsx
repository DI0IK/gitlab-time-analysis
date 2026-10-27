import * as React from 'react'
import {
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  FileCode,
  FileWarning,
  Download,
  Link as LinkIcon,
  Eye,
  Code,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/ui/markdown'

export interface FileBlobData {
  file_name: string
  file_path: string
  size: number
  content: string
  is_binary: boolean
  ref_name: string
  commit_id?: string
  last_commit_id?: string
}

interface CodeViewerProps {
  data: FileBlobData
  projectWebUrl?: string
  onBack: () => void
  isLoading?: boolean
  selectedLine?: string
  onSelectLine?: (line: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript (React)',
    js: 'JavaScript',
    jsx: 'JavaScript (React)',
    rs: 'Rust',
    py: 'Python',
    go: 'Go',
    java: 'Java',
    c: 'C',
    cpp: 'C++',
    h: 'C Header',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    md: 'Markdown',
    sql: 'SQL',
    sh: 'Shell',
    bash: 'Bash',
    dockerfile: 'Docker',
  }
  return map[ext] || (ext ? ext.toUpperCase() : 'Plain Text')
}

function parseLineRange(selectedLine?: string): { start: number; end: number } | null {
  if (!selectedLine) return null
  if (selectedLine.includes('-')) {
    const [start, end] = selectedLine.split('-').map(Number)
    if (!isNaN(start) && !isNaN(end)) {
      return { start: Math.min(start, end), end: Math.max(start, end) }
    }
  }
  const single = Number(selectedLine)
  if (!isNaN(single)) {
    return { start: single, end: single }
  }
  return null
}

export function CodeViewer({
  data,
  projectWebUrl,
  onBack,
  isLoading,
  selectedLine,
  onSelectLine,
}: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false)
  const [copiedPath, setCopiedPath] = React.useState(false)
  const [copiedLink, setCopiedLink] = React.useState(false)

  const isMarkdown = Boolean(
    !data.is_binary &&
      (data.file_name.toLowerCase().endsWith('.md') ||
        data.file_name.toLowerCase().endsWith('.markdown'))
  )

  const [userViewMode, setUserViewMode] = React.useState<{ path: string; mode: 'preview' | 'code' } | null>(null)
  const viewMode = userViewMode?.path === data.file_path
    ? userViewMode.mode
    : (isMarkdown && !selectedLine ? 'preview' : 'code')

  const lineRange = React.useMemo(() => parseLineRange(selectedLine), [selectedLine])

  // Scroll to selected line on mount
  React.useEffect(() => {
    if (lineRange?.start && typeof document !== 'undefined') {
      const el = document.getElementById(`L${lineRange.start}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [lineRange?.start])

  const handleCopy = async () => {
    if (!data.content) return
    try {
      await navigator.clipboard.writeText(data.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(data.file_path)
      setCopiedPath(true)
      setTimeout(() => setCopiedPath(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleCopyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      // Fallback
    }
  }

  const handleDownload = () => {
    const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = data.file_name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLineClick = (lineNum: number, event: React.MouseEvent) => {
    if (!onSelectLine) return
    if (event.shiftKey && lineRange?.start) {
      const start = Math.min(lineRange.start, lineNum)
      const end = Math.max(lineRange.start, lineNum)
      onSelectLine(`${start}-${end}`)
    } else {
      onSelectLine(String(lineNum))
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 p-6 space-y-4 animate-pulse shadow-xs">
        <div className="h-6 rounded bg-muted/40 w-1/3" />
        <div className="h-64 rounded bg-muted/30 w-full" />
      </div>
    )
  }

  const lines = data.is_binary ? [] : data.content.split('\n')
  const externalFileUrl = projectWebUrl
    ? `${projectWebUrl.replace(/\/+$/, '')}/-/blob/${encodeURIComponent(
        data.ref_name
      )}/${data.file_path}`
    : undefined

  const lang = getLanguage(data.file_name)

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xs overflow-hidden flex flex-col shadow-xs">
      {/* File Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            title="Back to directory"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <FileCode className="h-4 w-4 text-primary shrink-0" />
          <span className="font-mono text-xs font-semibold text-foreground truncate">
            {data.file_name}
          </span>

          <Badge variant="outline" className="text-[10px] font-mono shrink-0 hidden sm:inline-flex">
            {lang}
          </Badge>

          <Badge variant="outline" className="text-[10px] font-mono shrink-0 text-muted-foreground">
            {formatBytes(data.size)}
          </Badge>

          {!data.is_binary && (
            <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">
              {lines.length} lines
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMarkdown && (
            <div className="flex items-center rounded-md border border-border/60 bg-muted/50 p-0.5 mr-1">
              <button
                type="button"
                onClick={() => setUserViewMode({ path: data.file_path, mode: 'preview' })}
                className={`flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Rendered Markdown Preview"
              >
                <Eye className="h-3 w-3" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setUserViewMode({ path: data.file_path, mode: 'code' })}
                className={`flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  viewMode === 'code'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Raw File & Line Numbers"
              >
                <Code className="h-3 w-3" />
                <span>Code</span>
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyPath}
            className="h-7 px-2 text-xs gap-1 font-mono text-muted-foreground hover:text-foreground min-h-0"
            title="Copy file path"
          >
            {copiedPath ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            <span className="hidden sm:inline">Path</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyPermalink}
            className="h-7 px-2 text-xs gap-1 font-mono text-muted-foreground hover:text-foreground min-h-0"
            title="Copy link to file"
          >
            {copiedLink ? <Check className="h-3 w-3 text-emerald-500" /> : <LinkIcon className="h-3 w-3" />}
            <span className="hidden sm:inline">Link</span>
          </Button>

          {!data.is_binary && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-7 px-2.5 text-xs gap-1 font-mono min-h-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-muted-foreground" />
                    <span>Copy Raw</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="h-7 px-2 text-xs gap-1 font-mono min-h-0"
                title="Download file"
              >
                <Download className="h-3 w-3 text-muted-foreground" />
                <span className="hidden md:inline">Download</span>
              </Button>
            </>
          )}

          {externalFileUrl && (
            <a
              href={externalFileUrl}
              target="_blank"
              rel="noreferrer"
              title="Open file in GitLab"
              className="inline-flex items-center gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-mono rounded hover:bg-accent/40 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden lg:inline">GitLab</span>
            </a>
          )}
        </div>
      </div>

      {/* Code / Content Area */}
      {data.is_binary ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="p-3 rounded-full bg-muted/60 mb-3">
            <FileWarning className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-sm font-semibold text-foreground">Binary file</p>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            This file cannot be displayed in the text viewer. ({formatBytes(data.size)})
          </p>
          {externalFileUrl && (
            <a
              href={externalFileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <span>View on GitLab</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      ) : isMarkdown && viewMode === 'preview' ? (
        <div className="overflow-y-auto max-h-[78vh] p-6 md:p-8 bg-background/50">
          <div className="max-w-4xl mx-auto">
            <Markdown content={data.content} className="text-sm leading-relaxed" />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[72vh] bg-background/50 font-mono text-xs leading-relaxed">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => {
                const lineNum = idx + 1
                const isSelected =
                  lineRange && lineNum >= lineRange.start && lineNum <= lineRange.end

                return (
                  <tr
                    key={lineNum}
                    id={`L${lineNum}`}
                    className={`group transition-colors ${
                      isSelected
                        ? 'bg-primary/15 border-l-2 border-primary'
                        : 'hover:bg-accent/30'
                    }`}
                  >
                    <td
                      onClick={(e) => handleLineClick(lineNum, e)}
                      className={`w-12 select-none text-right pr-4 pl-2 py-0.5 text-[11px] border-r border-border/40 shrink-0 align-top cursor-pointer ${
                        isSelected
                          ? 'text-primary font-bold'
                          : 'text-muted-foreground/50 group-hover:text-muted-foreground'
                      }`}
                    >
                      {lineNum}
                    </td>
                    <td className="pl-4 pr-3 py-0.5 whitespace-pre font-mono text-[12px] text-foreground/90 overflow-visible align-top">
                      {line || ' '}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
