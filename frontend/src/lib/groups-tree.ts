export interface GroupRecord {
  id: string
  full_path: string
  name: string
  parent_id?: string | null
  parent_name?: string | null
  level: number
  web_url: string
  synced_at: string
}

export interface GroupTreeNode {
  group: GroupRecord
  children: GroupTreeNode[]
  slug: string
  totalDescendants: number
}

export function buildGroupTree(groups: GroupRecord[]): GroupTreeNode[] {
  if (!groups || groups.length === 0) return []

  const nodeMap = new Map<string, GroupTreeNode>()
  const rootNodes: GroupTreeNode[] = []

  // Create node for each group
  for (const g of groups) {
    nodeMap.set(g.id, {
      group: g,
      children: [],
      slug: g.full_path.replace(/\//g, '-'),
      totalDescendants: 0,
    })
  }

  // Connect children to parents
  for (const g of groups) {
    const node = nodeMap.get(g.id)
    if (!node) continue

    if (g.parent_id && nodeMap.has(g.parent_id)) {
      nodeMap.get(g.parent_id)!.children.push(node)
    } else {
      rootNodes.push(node)
    }
  }

  // Sort children alphabetically and calculate total descendants recursively
  function sortAndCount(node: GroupTreeNode): number {
    node.children.sort((a, b) => a.group.name.localeCompare(b.group.name))
    let count = node.children.length
    for (const child of node.children) {
      count += sortAndCount(child)
    }
    node.totalDescendants = count
    return count
  }

  rootNodes.sort((a, b) => a.group.name.localeCompare(b.group.name))
  for (const root of rootNodes) {
    sortAndCount(root)
  }

  return rootNodes
}

export function getAllNodeIds(nodes: GroupTreeNode[]): string[] {
  const ids: string[] = []
  function collect(node: GroupTreeNode) {
    ids.push(node.group.id)
    for (const child of node.children) {
      collect(child)
    }
  }
  for (const node of nodes) {
    collect(node)
  }
  return ids
}

export function filterTree(nodes: GroupTreeNode[], search: string): GroupTreeNode[] {
  const query = search.trim().toLowerCase()
  if (!query) return nodes

  function filterNode(node: GroupTreeNode): GroupTreeNode | null {
    const matchesSelf =
      node.group.name.toLowerCase().includes(query) ||
      node.group.full_path.toLowerCase().includes(query) ||
      node.slug.toLowerCase().includes(query)

    const filteredChildren = node.children
      .map(filterNode)
      .filter((child): child is GroupTreeNode => child !== null)

    if (matchesSelf || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      }
    }
    return null
  }

  return nodes
    .map(filterNode)
    .filter((node): node is GroupTreeNode => node !== null)
}

