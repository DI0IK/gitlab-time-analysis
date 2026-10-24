import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/use-auth'
import { User, Check, Sparkles } from 'lucide-react'

export function SettingsView() {
  const { user } = useAuth()
  const [customName, setCustomName] = useState(user?.customDisplayName || '')
  const [saved, setSaved] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customDisplayName: customName || null }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Ignored
    }
  }

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
                placeholder={user?.name || 'Enter custom display name'}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave empty to fallback to your GitLab account name ({user?.name || '@username'}).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" className="gap-1.5">
                {saved ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {saved ? 'Saved!' : 'Save Display Name'}
              </Button>
            </div>
          </form>
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
