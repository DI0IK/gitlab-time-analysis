import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { apiClient } from '@/lib/api/client'
import { apiKeys } from '@/lib/api/keys'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FolderGit2,
  RefreshCw,
  ArrowLeft,
  FileText,
  ChevronDown,
} from 'lucide-react'
import { type RepoBranch } from './branch-selector'
import { FileBreadcrumbs } from './file-breadcrumbs'
import { FileTree, type TreeItem } from './file-tree'
import { CodeViewer, type FileBlobData } from './code-viewer'
import { CommitHistory, type CommitItem } from './commit-history'
import { RepoExplorerSidebar } from './repo-explorer-sidebar'
import { RepoGrid, type RepositoryItem } from './repo-grid'
import { RepoToolbar } from './repo-toolbar'
import { Markdown } from '@/components/ui/markdown'

import { useTenant } from '@/features/tenant/tenant-context'

export function RepoBrowserView({
  slug,
  rootSlug: propRootSlug,
  groupSlug: propGroupSlug,
}: {
  slug?: string
  rootSlug?: string
  groupSlug?: string
}) {
  const tenant = useTenant()
  const effectiveRootSlug = propRootSlug || tenant.rootSlug
  const effectiveGroupSlug = propGroupSlug || slug || tenant.groupSlug || ''

  const search = useSearch({ strict: false }) as any
  const navigate = useNavigate()

  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [projectDropdownOpen, setProjectDropdownOpen] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // 1. Fetch repositories under this group
  const {
    data: repos = [],
    isLoading: isReposLoading,
    error: reposError,
    refetch: refetchRepos,
    isFetching: isReposFetching,
  } = useQuery({
    queryKey: apiKeys.rootRepositories(effectiveRootSlug, effectiveGroupSlug),
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        '/api/{root_slug}/groups/{group_slug}/repositories',
        {
          params: {
            path: {
              root_slug: effectiveRootSlug,
              group_slug: effectiveGroupSlug,
            },
          },
        }
      )
      if (error || !data) throw new Error('Failed to load repositories')
      return data as RepositoryItem[]
    },
    enabled: Boolean(effectiveRootSlug && effectiveGroupSlug),
  })

  // Validate active project from search param
  const effectiveProject = React.useMemo(() => {
    if (!search.project) return null
    if (!repos.length) return search.project
    return repos.some((r) => r.full_path === search.project) ? search.project : null
  }, [search.project, repos])

  // 2. Fetch branches for the selected repository
  const { data: branches = [], isLoading: isBranchesLoading } = useQuery({
    queryKey: apiKeys.rootRepoBranches(effectiveRootSlug, effectiveProject ?? ''),
    queryFn: async () => {
      if (!effectiveProject) return []
      const { data, error } = await apiClient.GET('/api/{root_slug}/repo/branches', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: { project: effectiveProject },
        },
      })
      if (error || !data) throw new Error('Failed to load branches')
      return data as RepoBranch[]
    },
    enabled: Boolean(effectiveRootSlug && effectiveProject),
  })

  // Derive active branch
  const effectiveBranch =
    search.ref || branches.find((b) => b.default)?.name || branches[0]?.name || ''

  const currentPath = search.path || ''
  const activeTab = search.view || 'code'
  const selectedLine = search.line

  // Detect if current path points to a file blob
  const isFilePath = React.useMemo(() => {
    if (!currentPath) return false
    return /\.[a-z0-9_-]+$/i.test(currentPath)
  }, [currentPath])

  // Containing directory for tree fetching
  const currentDirectory = React.useMemo(() => {
    if (!currentPath) return ''
    if (isFilePath) {
      const parts = currentPath.split('/')
      parts.pop()
      return parts.join('/')
    }
    return currentPath
  }, [currentPath, isFilePath])

  // 3. Fetch directory tree for containing directory
  const {
    data: treeItems,
    isLoading: isTreeLoading,
    refetch: refetchTree,
  } = useQuery({
    queryKey: apiKeys.rootRepoTree(effectiveRootSlug, effectiveProject ?? '', currentDirectory, effectiveBranch),
    queryFn: async () => {
      if (!effectiveProject) return []
      const { data, error } = await apiClient.GET('/api/{root_slug}/repo/tree', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: {
            project: effectiveProject,
            ref: effectiveBranch || undefined,
            path: currentDirectory || undefined,
          },
        },
      })
      if (error || !data) throw new Error('Failed to load tree')
      return data as TreeItem[]
    },
    enabled: Boolean(effectiveRootSlug && effectiveProject && activeTab === 'code'),
  })

  // 4. Fetch file blob if viewing a file
  const { data: fileBlob, isLoading: isBlobLoading } = useQuery({
    queryKey: apiKeys.rootRepoBlob(effectiveRootSlug, effectiveProject ?? '', currentPath, effectiveBranch),
    queryFn: async () => {
      if (!effectiveProject || !currentPath || !isFilePath) return null
      const { data, error } = await apiClient.GET('/api/{root_slug}/repo/blob', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: {
            project: effectiveProject,
            file_path: currentPath,
            ref: effectiveBranch || undefined,
          },
        },
      })
      if (error || !data) return null
      return data as FileBlobData
    },
    enabled: Boolean(effectiveRootSlug && effectiveProject && currentPath && isFilePath && activeTab === 'code'),
  })

  // 5. Look for README.md in directory
  const readmeItem = React.useMemo(() => {
    if (isFilePath || !treeItems) return null
    return treeItems.find(
      (item) => item.type === 'blob' && /^readme\.(md|markdown)$/i.test(item.name)
    )
  }, [isFilePath, treeItems])

  const { data: readmeBlob } = useQuery({
    queryKey: apiKeys.rootRepoBlob(effectiveRootSlug, effectiveProject ?? '', readmeItem?.path ?? '', effectiveBranch),
    queryFn: async () => {
      if (!effectiveProject || !readmeItem) return null
      const { data, error } = await apiClient.GET('/api/{root_slug}/repo/blob', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: {
            project: effectiveProject,
            file_path: readmeItem.path,
            ref: effectiveBranch || undefined,
          },
        },
      })
      if (error || !data) return null
      return data as FileBlobData
    },
    enabled: Boolean(effectiveRootSlug && effectiveProject && readmeItem && !isFilePath && activeTab === 'code'),
  })

  // 6. Fetch commits history
  const {
    data: commits = [],
    isLoading: isCommitsLoading,
    refetch: refetchCommits,
  } = useQuery({
    queryKey: apiKeys.rootRepoCommits(effectiveRootSlug, effectiveProject ?? '', currentPath, effectiveBranch),
    queryFn: async () => {
      if (!effectiveProject) return []
      const { data, error } = await apiClient.GET('/api/{root_slug}/repo/commits', {
        params: {
          path: { root_slug: effectiveRootSlug },
          query: {
            project: effectiveProject,
            ref: effectiveBranch || undefined,
            path: currentPath || undefined,
            limit: 40,
          },
        },
      })
      if (error || !data) throw new Error('Failed to load commits')
      return data as CommitItem[]
    },
    enabled: Boolean(effectiveRootSlug && effectiveProject && activeTab === 'commits'),
  })

  // Close project switcher dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeRepo = repos.find((r) => r.full_path === effectiveProject)
  const activeRepoName = activeRepo?.name ?? effectiveProject?.split('/').pop() ?? 'Repository'

  const handleSelectRepo = (fullPath: string) => {
    setProjectDropdownOpen(false)
    navigate({
      search: (() => ({
        project: fullPath,
        ref: undefined,
        path: undefined,
        view: 'code',
        line: undefined,
      })) as any,
    })
  }

  const handleResetToAllRepos = () => {
    navigate({ search: (() => ({})) as any })
  }

  const handleSelectBranch = (branch: string) => {
    navigate({
      search: ((prev: any) => ({ ...prev, ref: branch, line: undefined })) as any,
    })
  }

  const handleSelectPath = (newPath: string) => {
    navigate({
      search: ((prev: any) => ({ ...prev, path: newPath || undefined, line: undefined })) as any,
    })
  }

  const handleNavigateUp = () => {
    if (!currentDirectory) return
    const parts = currentDirectory.split('/').filter(Boolean)
    parts.pop()
    handleSelectPath(parts.join('/'))
  }

  const handleTabChange = (view: 'code' | 'commits') => {
    navigate({
      search: ((prev: any) => ({ ...prev, view, line: undefined })) as any,
    })
  }

  const handleSelectLine = (lineStr: string) => {
    navigate({
      search: ((prev: any) => ({ ...prev, line: lineStr })) as any,
    })
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight font-display flex items-center gap-2">
              {effectiveProject ? (
                <>
                  <button
                    type="button"
                    onClick={handleResetToAllRepos}
                    className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Return to All Repositories"
                  >
                    Code Browser
                  </button>
                  <span className="text-muted-foreground font-normal text-lg">/</span>
                  <div className="relative inline-block" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                      className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
                    >
                      <span>{activeRepoName}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>

                    {projectDropdownOpen && (
                      <div className="absolute left-0 mt-2 w-72 rounded-xl border border-border/80 bg-card p-2 shadow-xl z-50">
                        <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Switch Repository
                        </p>
                        <div className="max-h-60 overflow-y-auto space-y-0.5">
                          {repos.map((r) => (
                            <button
                              key={r.full_path}
                              type="button"
                              onClick={() => handleSelectRepo(r.full_path)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate transition-colors cursor-pointer ${
                                r.full_path === effectiveProject
                                  ? 'bg-primary/15 text-primary font-medium'
                                  : 'hover:bg-accent hover:text-foreground'
                              }`}
                            >
                              <div className="font-medium truncate">{r.name}</div>
                              <div className="text-[10px] text-muted-foreground truncate font-mono">
                                {r.full_path}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                'Code & Repository Browser'
              )}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {effectiveProject
              ? `Browse source code, inspect branches, view commits, and explore documentation for ${effectiveProject}`
              : `GitLab project repositories, branch structures, and code bases for ${slug}.`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {effectiveProject && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToAllRepos}
              className="gap-1.5 text-xs font-mono min-h-[36px]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All Repositories</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!effectiveProject) {
                refetchRepos()
              } else if (activeTab === 'code') {
                refetchTree()
              } else {
                refetchCommits()
              }
            }}
            disabled={isReposFetching}
            className="min-h-[36px] gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isReposFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* VIEW 1: REPOSITORY LISTING */}
      {!effectiveProject ? (
        <RepoGrid
          repos={repos}
          isLoading={isReposLoading}
          error={reposError}
          onSelectRepo={handleSelectRepo}
        />
      ) : (
        /* VIEW 2: ACTIVE REPOSITORY CODE BROWSER */
        <div className="space-y-4">
          <RepoToolbar
            branches={branches}
            selectedBranch={effectiveBranch}
            recentCommits={commits}
            activeTab={activeTab}
            sidebarOpen={sidebarOpen}
            gitlabWebUrl={activeRepo?.web_url}
            isBranchesLoading={isBranchesLoading}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onSelectBranch={handleSelectBranch}
            onTabChange={handleTabChange}
          />

          {/* TAB 1: CODE EXPLORER & VIEWER */}
          {activeTab === 'code' && (
            <div className="space-y-3">
              <FileBreadcrumbs
                repoName={activeRepoName}
                currentPath={currentPath}
                onNavigate={handleSelectPath}
              />

              <div className="flex flex-col md:flex-row gap-4 items-start">
                {sidebarOpen && (
                  <div className="w-full md:w-64 md:shrink-0 h-[650px]">
                    <RepoExplorerSidebar
                      items={treeItems || []}
                      currentPath={currentDirectory}
                      selectedFile={isFilePath ? currentPath : null}
                      onSelectPath={handleSelectPath}
                      onSelectFile={handleSelectPath}
                      onNavigateUp={handleNavigateUp}
                      isLoading={isTreeLoading}
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0 w-full space-y-4">
                  {isFilePath && fileBlob ? (
                    <CodeViewer
                      key={fileBlob.file_path}
                      data={fileBlob}
                      projectWebUrl={activeRepo?.web_url}
                      onBack={() => handleSelectPath(currentDirectory)}
                      isLoading={isBlobLoading}
                      selectedLine={selectedLine}
                      onSelectLine={handleSelectLine}
                    />
                  ) : (
                    <div className="space-y-4">
                      <FileTree
                        items={treeItems || []}
                        currentPath={currentDirectory}
                        onSelectPath={handleSelectPath}
                        onSelectFile={handleSelectPath}
                        onNavigateUp={handleNavigateUp}
                        isLoading={isTreeLoading}
                      />

                      {readmeBlob && (
                        <Card className="border-border/60 bg-card/40 backdrop-blur-xs overflow-hidden shadow-xs">
                          <CardHeader className="py-2.5 px-4 border-b border-border/50 bg-muted/20 flex flex-row items-center gap-2">
                            <FileText className="h-4 w-4 text-emerald-400" />
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {readmeBlob.file_name}
                            </span>
                          </CardHeader>
                          <CardContent className="p-6">
                            <Markdown
                              content={readmeBlob.content}
                              className="text-sm leading-relaxed"
                            />
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMMITS */}
          {activeTab === 'commits' && (
            <div className="space-y-3">
              <CommitHistory
                commits={commits}
                isLoading={isCommitsLoading}
                onSelectCommit={(commitId) => {
                  handleSelectBranch(commitId)
                  handleTabChange('code')
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
