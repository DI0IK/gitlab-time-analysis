import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { useAuth } from '@/features/auth/use-auth'
import { apiKeys } from '@/lib/api/keys'
import {
  User,
  Check,
  Sparkles,
  Loader2,
  Key,
  Copy,
  Trash2,
  Plus,
  AlertTriangle,
  Terminal,
  ShieldCheck,
} from 'lucide-react'

interface ApiKeyItem {
  id: string
  name: string
  key_prefix: string
  scopes: string
  last_used_at: string | null
  expires_at: string | null
  created_at: string | null
}

interface CreatedKeyResponse {
  id: string
  name: string
  key: string
  key_prefix: string
  scopes: string
  expires_at: string | null
  created_at: string | null
}

function DisplayNameForm({
  initialName,
  placeholder,
}: {
  initialName: string
  placeholder: string
}) {
  const queryClient = useQueryClient()
  const [customName, setCustomName] = useState(initialName)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMsg(null)
    try {
      const trimmed = customName.trim()
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_display_name: trimmed || null,
          customDisplayName: trimmed || null,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to update display name')
      }

      await queryClient.invalidateQueries({ queryKey: apiKeys.authMe })
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] })

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label htmlFor="displayName" className="block text-xs font-medium text-foreground mb-1.5">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder={placeholder || 'Enter custom display name'}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Leave empty to fallback to your GitLab account name ({placeholder || '@username'}).
        </p>
      </div>

      {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Display Name'}
        </Button>
      </div>
    </form>
  )
}

function ApiKeysSection() {
  const queryClient = useQueryClient()
  const [now] = useState(() => Date.now())
  const [isGenerating, setIsGenerating] = useState(false)
  const [name, setName] = useState('')
  const [expiryDays, setExpiryDays] = useState('90')
  const [revealedKey, setRevealedKey] = useState<CreatedKeyResponse | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data: keys = [], isLoading } = useQuery<ApiKeyItem[]>({
    queryKey: apiKeys.userApiKeys,
    queryFn: async () => {
      const res = await fetch('/api/user/api-keys')
      if (!res.ok) throw new Error('Failed to fetch API keys')
      return res.json()
    },
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsGenerating(true)
    setErrorMsg(null)

    try {
      const days = expiryDays === 'never' ? null : parseInt(expiryDays, 10)
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          expires_in_days: days,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.error || 'Failed to create API key')
      }

      const created: CreatedKeyResponse = await res.json()
      setRevealedKey(created)
      setName('')
      await queryClient.invalidateQueries({ queryKey: apiKeys.userApiKeys })
    } catch (err: any) {
      setErrorMsg(err.message || 'Error generating key')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? External clients using it will lose access immediately.')) {
      return
    }

    setRevokingId(id)
    try {
      const res = await fetch(`/api/user/api-keys/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to revoke key')
      await queryClient.invalidateQueries({ queryKey: apiKeys.userApiKeys })
    } catch (err: any) {
      alert(err.message || 'Failed to revoke key')
    } finally {
      setRevokingId(null)
    }
  }

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080'
  const mcpConfigSnippet = revealedKey
    ? JSON.stringify(
        {
          mcpServers: {
            'gitlab-platform': {
              url: `${originUrl}/api/mcp/sse`,
              headers: {
                Authorization: `Bearer ${revealedKey.key}`,
              },
            },
          },
        },
        null,
        2,
      )
    : ''

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Personal API Keys & Web MCP Access
          </CardTitle>
          <CardDescription>
            Generate API keys for external AI developer agents (such as Cursor, Antigravity, or remote LLMs) connecting to this platform via the Model Context Protocol (MCP) over HTTP/SSE.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create Key Form */}
          <form onSubmit={handleCreate} className="space-y-3 p-4 rounded-lg border border-border/70 bg-muted/20">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Generate New API Key
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Key description (e.g. Cursor IDE, Antigravity)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="30">Expires in 30 days</option>
                  <option value="90">Expires in 90 days</option>
                  <option value="365">Expires in 1 year</option>
                  <option value="never">No expiration</option>
                </select>
              </div>
            </div>

            {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isGenerating || !name.trim()} className="gap-1.5">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate API Key
              </Button>
            </div>
          </form>

          {/* Active Keys Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Keys
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading keys...
              </div>
            ) : keys.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground rounded-lg border border-dashed border-border/70">
                No active API keys found. Generate a key above to enable programmatic or MCP access.
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                    <tr>
                      <th className="px-3.5 py-2.5">Name</th>
                      <th className="px-3.5 py-2.5">Prefix</th>
                      <th className="px-3.5 py-2.5">Created</th>
                      <th className="px-3.5 py-2.5">Last Used</th>
                      <th className="px-3.5 py-2.5">Expires</th>
                      <th className="px-3.5 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {keys.map((k) => (
                      <tr key={k.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3.5 py-2.5 font-medium text-foreground">{k.name}</td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground">
                          {k.key_prefix}…
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">
                          {k.created_at ? new Date(k.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">
                          {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-3.5 py-2.5 text-muted-foreground">
                          {k.expires_at ? (
                            <span className={new Date(k.expires_at).getTime() < now ? 'text-destructive font-medium' : ''}>
                              {new Date(k.expires_at).toLocaleDateString()}
                            </span>
                          ) : (
                            'Never'
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            disabled={revokingId === k.id}
                            onClick={() => handleRevoke(k.id)}
                          >
                            {revokingId === k.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* MCP Web Connection Guide */}
          <div className="p-4 rounded-lg border border-border/80 bg-muted/10 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Terminal className="h-4 w-4 text-primary" />
              Web MCP Server Configuration
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              External assistants can connect directly to your platform via Server-Sent Events (SSE) by configuring the endpoint URL and passing your generated key as a Bearer token:
            </p>
            <div className="p-2.5 rounded bg-background border border-border font-mono text-[11px] text-muted-foreground break-all select-all">
              Endpoint: <span className="text-foreground font-semibold">{originUrl}/api/mcp/sse</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* One-Time Reveal Modal */}
      {revealedKey && (
        <Modal
          isOpen={true}
          onClose={() => setRevealedKey(null)}
          title={
            <div className="flex items-center gap-2 text-emerald-500 font-semibold text-base">
              <ShieldCheck className="h-5 w-5" />
              API Key Generated Successfully
            </div>
          }
          description="Copy your key now. For your security, this key will never be shown again."
        >
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Please store this key securely. If you lose this key, you will need to revoke it and generate a new one.
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Secret API Key ({revealedKey.name})
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={revealedKey.key}
                  className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={() => copyToClipboard(revealedKey.key, setCopiedKey)}
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey ? 'Copied!' : 'Copy Key'}
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-foreground">
                  Ready-to-use Cursor / Antigravity MCP Config
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] gap-1"
                  onClick={() => copyToClipboard(mcpConfigSnippet, setCopiedConfig)}
                >
                  {copiedConfig ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedConfig ? 'Copied Config' : 'Copy Config'}
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-muted/40 border border-border font-mono text-[11px] text-muted-foreground overflow-x-auto">
                {mcpConfigSnippet}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setRevealedKey(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

export function SettingsView() {
  const { user } = useAuth()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-display">User Profile & Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure your personal platform preferences, custom display name, and API keys.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Custom Display Name
          </CardTitle>
          <CardDescription>
            This name will be displayed across all tables, charts, leaderboard entries, and avatar tooltips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DisplayNameForm
            key={user?.username || 'loading'}
            initialName={user?.customDisplayName || ''}
            placeholder={user?.name || user?.username || ''}
          />
        </CardContent>
      </Card>

      <ApiKeysSection />

      <Card>
        <CardHeader>
          <CardTitle>Gamification & Achievements</CardTitle>
          <CardDescription>Your unlocked achievements and progression tier.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="silver">Silver Tier • Level 11</Badge>
            <span className="text-xs text-muted-foreground">2,180 XP accumulated</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
