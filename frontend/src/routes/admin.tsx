import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck,
  FolderGit2,
  Users,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRight,
  Lock,
  X,
  Check,
} from 'lucide-react'
import { useAuth } from '@/features/auth/use-auth'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { Button } from '@/components/ui/button'
import type { components } from '@/lib/api/schema'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

type AdminRootGroup = components['schemas']['AdminRootGroupItem']
type AdminUser = components['schemas']['AdminUserItem']

function AdminPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<'root-groups' | 'users'>('root-groups')
  const [editingGroup, setEditingGroup] = useState<AdminRootGroup | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: rootGroups, isLoading: groupsLoading } = useQuery({
    queryKey: apiKeys.adminRootGroups,
    queryFn: async () => {
      const res = await apiClient.GET('/api/admin/root-groups')
      return (res.data as AdminRootGroup[]) ?? []
    },
    enabled: !!user?.isAdmin,
  })

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: apiKeys.adminUsers,
    queryFn: async () => {
      const res = await apiClient.GET('/api/admin/users')
      return (res.data as AdminUser[]) ?? []
    },
    enabled: !!user?.isAdmin,
  })

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.POST('/api/admin/root-groups/{id}/sync', {
        params: { path: { id } },
      })
      return res.data
    },
    onSuccess: () => {
      setSyncStatusMsg('Ingestion and sync triggered successfully!')
      setTimeout(() => setSyncStatusMsg(null), 4000)
      queryClient.invalidateQueries({ queryKey: apiKeys.roots })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.DELETE('/api/admin/root-groups/{id}', {
        params: { path: { id } },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeys.adminRootGroups })
      queryClient.invalidateQueries({ queryKey: apiKeys.roots })
    },
  })

  const [managingAccessUser, setManagingAccessUser] = useState<AdminUser | null>(null)

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ username, isAdmin }: { username: string; isAdmin: boolean }) => {
      await apiClient.PUT('/api/admin/users/{username}/permissions', {
        params: { path: { username } },
        body: { is_admin: isAdmin },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeys.adminUsers })
    },
  })

  const updateTenantAccessMutation = useMutation({
    mutationFn: async ({
      username,
      rootGroupIds,
    }: {
      username: string
      rootGroupIds: string[]
    }) => {
      await apiClient.PUT('/api/admin/users/{username}/permissions', {
        params: { path: { username } },
        body: { root_group_ids: rootGroupIds },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeys.adminUsers })
      setManagingAccessUser(null)
    },
  })

  if (authLoading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Verifying administrative access...</p>
      </div>
    )
  }

  if (!user?.isAdmin) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Platform Administration is restricted to designated administrators.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          Return to Dashboard <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Platform Administration</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage multi-tenant root groups, GitLab ingestion sources, timeframes, and user access
            control.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-secondary/40 p-1">
          <button
            onClick={() => setActiveTab('root-groups')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'root-groups'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FolderGit2 className="h-3.5 w-3.5" />
            <span>Root Groups ({rootGroups?.length ?? 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'users'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Users & Access ({users?.length ?? 0})</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-400 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* TAB 1: Root Groups */}
      {activeTab === 'root-groups' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Managed Root Groups</h2>
              <p className="text-xs text-muted-foreground">
                Each root group acts as an isolated tenant with its own semester/cohort timeframe
                and sprint duration.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              className="gap-1.5 text-xs h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Root Group</span>
            </Button>
          </div>

          {groupsLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading root groups...
            </div>
          ) : rootGroups?.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center">
              <FolderGit2 className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm font-medium">No root groups configured yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your first root group to begin syncing GitLab data.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {rootGroups?.map((group) => (
                <div
                  key={group.id}
                  className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md p-5 space-y-4 hover:border-border transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base tracking-tight">{group.name}</span>
                        <span className="font-mono text-[10px] rounded-md bg-secondary px-2 py-0.5 text-muted-foreground font-semibold">
                          /{group.slug}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        GitLab: {group.gitlab_group_path}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => syncMutation.mutate(group.id)}
                        disabled={syncMutation.isPending}
                        title="Trigger immediate sync"
                        className="h-7 w-7 p-0"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${
                            syncMutation.isPending ? 'animate-spin text-primary' : ''
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingGroup(group)}
                        title="Edit root group"
                        className="h-7 w-7 p-0"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete root group "${group.name}"?`)) {
                            deleteMutation.mutate(group.id)
                          }
                        }}
                        title="Delete root group"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground bg-secondary/30 rounded-lg p-2 border border-border/30">
                      <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">
                        {group.project_start_date}
                        {group.project_end_date ? ` → ${group.project_end_date}` : ' (active)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground bg-secondary/30 rounded-lg p-2 border border-border/30">
                      <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>
                        {group.sprint_duration_weeks}w sprints • {group.sprint_start_weekday}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {group.user_count} users with access
                    </span>
                    <span
                      className={`font-semibold ${
                        group.has_token ? 'text-emerald-500' : 'text-amber-500'
                      }`}
                    >
                      {group.has_token ? 'Dedicated Token' : 'Default Token'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Users & Permissions */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">User Permissions & Roles</h2>
            <p className="text-xs text-muted-foreground">
              GitLab group members automatically gain access. You can grant administrative rights or
              manually grant root group access.
            </p>
          </div>

          {usersLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading users...</div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/40 bg-muted/40 font-semibold text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Accessible Tenants</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {users?.map((u) => (
                      <tr key={u.username} className="hover:bg-accent/30 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.name}
                                className="h-7 w-7 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary font-bold text-[10px]">
                                {u.username.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-foreground">{u.name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">
                                @{u.username}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {u.is_admin ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-500">
                              <ShieldCheck className="h-3 w-3" />
                              Platform Admin
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Member</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {u.permissions.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground italic">
                                No tenants assigned
                              </span>
                            ) : (
                              u.permissions.map((p) => (
                                <span
                                  key={p.root_group_id}
                                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${
                                    p.source === 'gitlab'
                                      ? 'bg-secondary/60 text-secondary-foreground border-border/40'
                                      : 'bg-primary/10 text-primary border-primary/20'
                                  }`}
                                  title={`Tenant: ${p.root_group_name} (${p.root_group_slug}) • Granted via: ${p.source}`}
                                >
                                  {p.root_group_slug}
                                  {p.source === 'manual' && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const newIds = u.permissions
                                          .filter((item) => item.root_group_id !== p.root_group_id)
                                          .map((item) => item.root_group_id)
                                        updateTenantAccessMutation.mutate({
                                          username: u.username,
                                          rootGroupIds: newIds,
                                        })
                                      }}
                                      className="text-muted-foreground hover:text-destructive transition ml-0.5"
                                      title="Remove tenant access"
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </span>
                              ))
                            )}
                            <button
                              type="button"
                              onClick={() => setManagingAccessUser(u)}
                              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition"
                              title="Assign or manage tenant access"
                            >
                              <Plus className="h-2.5 w-2.5" />
                              <span>Assign</span>
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setManagingAccessUser(u)}
                              className="h-7 text-[11px] gap-1"
                              title="Manage tenant access"
                            >
                              <FolderGit2 className="h-3 w-3 text-muted-foreground" />
                              <span>Tenant Access</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                toggleAdminMutation.mutate({
                                  username: u.username,
                                  isAdmin: !u.is_admin,
                                })
                              }
                              className={`h-7 text-[11px] ${u.is_admin ? 'text-amber-500 hover:text-amber-600' : ''}`}
                            >
                              {u.is_admin ? 'Revoke Admin' : 'Make Admin'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal / Dialog for Add / Edit Root Group */}
      {(isCreating || editingGroup) && (
        <RootGroupModal
          initialData={editingGroup}
          onClose={() => {
            setIsCreating(false)
            setEditingGroup(null)
          }}
          onSave={() => {
            setIsCreating(false)
            setEditingGroup(null)
            queryClient.invalidateQueries({ queryKey: apiKeys.adminRootGroups })
            queryClient.invalidateQueries({ queryKey: apiKeys.roots })
          }}
        />
      )}

      {/* Modal / Dialog for User Tenant Access */}
      {managingAccessUser && (
        <UserTenantAccessModal
          user={managingAccessUser}
          rootGroups={rootGroups ?? []}
          onClose={() => setManagingAccessUser(null)}
          onSave={(rootGroupIds) =>
            updateTenantAccessMutation.mutate({
              username: managingAccessUser.username,
              rootGroupIds,
            })
          }
          isSaving={updateTenantAccessMutation.isPending}
        />
      )}
    </div>
  )
}

function RootGroupModal({
  initialData,
  onClose,
  onSave,
}: {
  initialData: AdminRootGroup | null
  onClose: () => void
  onSave: () => void
}) {
  const [slug, setSlug] = useState(initialData?.slug ?? '')
  const [name, setName] = useState(initialData?.name ?? '')
  const [path, setPath] = useState(initialData?.gitlab_group_path ?? '')
  const [token, setToken] = useState('')
  const [startDate, setStartDate] = useState(
    () => initialData?.project_start_date ?? new Date().toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(initialData?.project_end_date ?? '')
  const [durationWeeks, setDurationWeeks] = useState(initialData?.sprint_duration_weeks ?? 1)
  const [startWeekday, setStartWeekday] = useState(initialData?.sprint_start_weekday ?? 'Monday')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (initialData) {
        // Update
        const res = await apiClient.PUT('/api/admin/root-groups/{id}', {
          params: { path: { id: initialData.id } },
          body: {
            name,
            gitlab_group_path: path,
            token: token.trim() ? token.trim() : undefined,
            project_start_date: startDate,
            project_end_date: endDate.trim() ? endDate.trim() : null,
            sprint_start_weekday: startWeekday,
            sprint_duration_weeks: Number(durationWeeks),
          },
        })
        if (res.error) throw new Error(String(res.error))
      } else {
        // Create
        const res = await apiClient.POST('/api/admin/root-groups', {
          body: {
            slug: slug.trim(),
            name: name.trim(),
            gitlab_group_path: path.trim(),
            token: token.trim() ? token.trim() : undefined,
            project_start_date: startDate,
            project_end_date: endDate.trim() ? endDate.trim() : null,
            sprint_start_weekday: startWeekday,
            sprint_duration_weeks: Number(durationWeeks),
          },
        })
        if (res.error) throw new Error(String(res.error))
      }
      onSave()
    } catch (err: any) {
      setError(err?.message || 'Failed to save root group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <h3 className="text-lg font-bold tracking-tight">
          {initialData ? `Edit Root Group: ${initialData.name}` : 'Create New Root Group'}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Configure multi-tenant isolation, GitLab hierarchy root, and dynamic sprint settings.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          {!initialData && (
            <div>
              <label className="font-semibold block mb-1">Tenant Slug</label>
              <input
                required
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. tinf24, dhbw-sem1"
                className="w-full rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 outline-none focus:border-primary font-mono"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Display Name</label>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. TINF24 Cohort"
                className="w-full rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">GitLab Group Path</label>
              <input
                required
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="e.g. dhbw/tinf24"
                className="w-full rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 outline-none focus:border-primary font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">
              GitLab Token{' '}
              <span className="font-normal text-muted-foreground">
                (Optional, inherits default if empty)
              </span>
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={initialData?.has_token ? '•••••••• (leave blank to keep)' : 'glpat-...'}
              className="w-full rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 outline-none focus:border-primary font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Project Start Date</label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">
                Project End Date{' '}
                <span className="font-normal text-muted-foreground">(Optional)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Sprint Duration (Weeks)</label>
              <input
                required
                type="number"
                min="1"
                max="12"
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(Number(e.target.value))}
                className="w-full rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Sprint Start Weekday</label>
              <select
                value={startWeekday}
                onChange={(e) => setStartWeekday(e.target.value)}
                className="w-full rounded-lg border border-border/70 bg-secondary/50 px-3 py-2 outline-none focus:border-primary"
              >
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Saving...' : initialData ? 'Update Root Group' : 'Create Root Group'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UserTenantAccessModal({
  user,
  rootGroups,
  onClose,
  onSave,
  isSaving,
}: {
  user: AdminUser
  rootGroups: AdminRootGroup[]
  onClose: () => void
  onSave: (rootGroupIds: string[]) => void
  isSaving: boolean
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(user.permissions.map((p) => p.root_group_id))
  })

  const toggleRoot = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(rootGroups.map((g) => g.id)))
  }

  const clearAll = () => {
    setSelectedIds(new Set())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(Array.from(selectedIds))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-9 w-9 rounded-full object-cover border border-border/50"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-bold text-xs">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-base font-bold tracking-tight text-foreground">
                Manage Tenant Access
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                {user.name} (@{user.username})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {user.is_admin && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Platform Administrator</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                This user has administrative privileges and automatically retains unrestricted access to all tenants across the platform. You can still maintain explicit tenant assignments below.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">
            {selectedIds.size} of {rootGroups.length} tenants assigned
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              Select All
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
            >
              Clear All
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {rootGroups.map((group) => {
              const isChecked = selectedIds.has(group.id)
              const existingPerm = user.permissions.find((p) => p.root_group_id === group.id)

              return (
                <div
                  key={group.id}
                  onClick={() => toggleRoot(group.id)}
                  className={`flex items-center justify-between rounded-xl border p-2.5 transition cursor-pointer select-none text-xs ${
                    isChecked
                      ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                      : 'border-border/60 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                        isChecked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/80 bg-background'
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground truncate">{group.name}</span>
                        <span className="font-mono text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border border-border/40">
                          {group.slug}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                        {group.gitlab_group_path}
                      </p>
                    </div>
                  </div>

                  {existingPerm && (
                    <span
                      className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                        existingPerm.source === 'gitlab'
                          ? 'bg-secondary/60 text-secondary-foreground border-border/40'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      {existingPerm.source === 'gitlab' ? 'GitLab Member' : 'Manual Grant'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/50">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Tenant Access'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
