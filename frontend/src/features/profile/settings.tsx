import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/use-auth'
import { apiKeys } from '@/lib/api/keys'
import { User, Check, Sparkles, Loader2 } from 'lucide-react'

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

export function SettingsView() {
  const { user } = useAuth()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-display">User Profile & Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure your personal platform preferences and custom display name.
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
