import * as React from 'react'
import {
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  FileCode,
  FileWarning,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function CodeViewer({ data, projectWebUrl, onBack, isLoading }: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false)

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

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/60 p-6 space-y-4 animate-pulse">
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

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 backdrop-blur-xs overflow-hidden flex flex-col">
      {/* File Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            title="Back to folder"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <FileCode className="h-4 w-4 text-primary shrink-0" />
          <span className="font-mono text-xs font-semibold text-foreground truncate">
            {data.file_name}
          </span>
          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
            {formatBytes(data.size)}
          </Badge>
          {!data.is_binary && (
            <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
              {lines.length} lines
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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
                    <span>Copy</span>
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
              title="Open in GitLab"
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
      ) : (
        <div className="overflow-x-auto max-h-[70vh] bg-background/50 font-mono text-xs leading-relaxed">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => {
                const lineNum = idx + 1
                return (
                  <tr key={lineNum} className="hover:bg-accent/30 group">
                    <td className="w-12 select-none text-right pr-4 pl-2 py-0.5 text-[11px] text-muted-foreground/50 border-r border-border/40 group-hover:text-muted-foreground shrink-0 align-top">
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
