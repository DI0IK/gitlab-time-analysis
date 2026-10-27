import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { WorkItemModal, type WorkItemModalData } from '@/features/work-items/work-item-modal'
import { MergeRequestModal, type MergeRequestModalData } from '@/features/merge-requests/mr-modal'
import type { components } from '@/lib/api/schema'

import { useTenant } from '@/features/tenant/tenant-context'
import { apiKeys } from '@/lib/api/keys'

type GroupActivityItem = components['schemas']['GroupActivityItem']

export function ActivityModals({
  selectedTarget,
  slug,
  rootSlug: propRootSlug,
  onClose,
}: {
  selectedTarget: GroupActivityItem | null
  slug?: string
  rootSlug?: string
  onClose: () => void
}) {
  const tenant = useTenant()
  const effectiveRootSlug = propRootSlug || tenant.rootSlug
  const effectiveGroupSlug = slug || tenant.groupSlug || ''

  const isWi = selectedTarget?.target_type === 'work_item'
  const isMr = selectedTarget?.target_type === 'merge_request'

  const { data: workItems } = useQuery({
    queryKey: apiKeys.rootWorkItems(effectiveRootSlug, effectiveGroupSlug),
    queryFn: async () => {
      const { data } = await apiClient.GET('/api/{root_slug}/groups/{group_slug}/work-items', {
        params: { path: { root_slug: effectiveRootSlug, group_slug: effectiveGroupSlug } },
      })
      return (data || []) as WorkItemModalData[]
    },
    enabled: isWi && Boolean(effectiveRootSlug && effectiveGroupSlug),
  })

  const { data: mergeRequests } = useQuery({
    queryKey: apiKeys.rootMergeRequests(effectiveRootSlug, effectiveGroupSlug),
    queryFn: async () => {
      const { data } = await apiClient.GET('/api/{root_slug}/groups/{group_slug}/merge-requests', {
        params: { path: { root_slug: effectiveRootSlug, group_slug: effectiveGroupSlug } },
      })
      return (data || []) as MergeRequestModalData[]
    },
    enabled: isMr && Boolean(effectiveRootSlug && effectiveGroupSlug),
  })

  const activeWorkItem = React.useMemo<WorkItemModalData | null>(() => {
    if (!selectedTarget || !isWi) return null
    const found = workItems?.find((w) => w.id === selectedTarget.target_id)
    if (found) return found
    return {
      id: selectedTarget.target_id,
      iid: selectedTarget.target_iid ?? 0,
      title: selectedTarget.target_title,
      work_item_type: 'issue',
      state: 'opened',
      time_estimate: 0,
      total_time_spent: 0,
      web_url: selectedTarget.target_url || '',
      labels_json: '[]',
      created_at: selectedTarget.timestamp,
      synced_at: selectedTarget.timestamp,
    }
  }, [selectedTarget, isWi, workItems])

  const activeMr = React.useMemo<MergeRequestModalData | null>(() => {
    if (!selectedTarget || !isMr) return null
    const found = mergeRequests?.find((m) => m.id === selectedTarget.target_id)
    if (found) return found
    return {
      id: selectedTarget.target_id,
      iid: selectedTarget.target_iid ?? 0,
      title: selectedTarget.target_title,
      project_path: slug || '',
      state: 'opened',
      author_username: selectedTarget.author_username || 'unknown',
      source_branch: 'unknown',
      target_branch: 'main',
      web_url: selectedTarget.target_url || '',
      created_at: selectedTarget.timestamp,
      total_time_spent: 0,
      upvotes: 0,
      downvotes: 0,
      user_notes_count: 0,
      discussion_count: 0,
      additions: 0,
      deletions: 0,
      commits_count: 0,
      synced_at: selectedTarget.timestamp,
    }
  }, [selectedTarget, isMr, mergeRequests, slug])

  return (
    <>
      <WorkItemModal item={activeWorkItem} slug={slug} onClose={onClose} />
      <MergeRequestModal mr={activeMr} slug={slug} onClose={onClose} />
    </>
  )
}
