import { FileText, Folder, Home, ChevronRight, ChevronDown } from 'lucide-react'
import type { WikiPageItem } from './wiki-sidebar'

export interface WikiTreeNode {
  slug: string
  name: string
  page?: WikiPageItem
  children: WikiTreeNode[]
}

export function buildWikiTree(pages: WikiPageItem[]): WikiTreeNode[] {
  const nodeMap = new Map<string, WikiTreeNode>()

  const getOrCreate = (slug: string, name: string): WikiTreeNode => {
    let node = nodeMap.get(slug)
    if (!node) {
      node = { slug, name, children: [] }
      nodeMap.set(slug, node)
    }
    return node
  }

  for (const page of pages) {
    const parts = page.slug.split('/')
    let currentSlug = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentSlug = currentSlug ? `${currentSlug}/${part}` : part
      const node = getOrCreate(currentSlug, part)
      if (i === parts.length - 1) {
        node.page = page
        if (page.title) node.name = page.title
      }
    }
  }

  const rootNodes: WikiTreeNode[] = []
  for (const [slug, node] of nodeMap.entries()) {
    const lastSlash = slug.lastIndexOf('/')
    if (lastSlash === -1) {
      rootNodes.push(node)
    } else {
      const parentNode = nodeMap.get(slug.slice(0, lastSlash))
      if (parentNode) parentNode.children.push(node)
      else rootNodes.push(node)
    }
  }

  const sortNodes = (nodes: WikiTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.slug.toLowerCase() === 'home') return -1
      if (b.slug.toLowerCase() === 'home') return 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) {
      if (n.children.length > 0) sortNodes(n.children)
    }
  }

  sortNodes(rootNodes)
  return rootNodes
}

interface WikiItemNodeProps {
  node: WikiTreeNode
  selectedSlug: string | null
  expandedFolders: Record<string, boolean>
  onToggleFolder: (slug: string) => void
  onSelectPage: (slug: string) => void
}

export function WikiItemNode({
  node,
  selectedSlug,
  expandedFolders,
  onToggleFolder,
  onSelectPage,
}: WikiItemNodeProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expandedFolders[node.slug] ?? true
  const isSelected = Boolean(selectedSlug && (selectedSlug === node.slug || selectedSlug.toLowerCase() === node.slug.toLowerCase()))
  const isHome = node.slug.toLowerCase() === 'home'

  return (
    <div className="pt-0.5">
      <div
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
          isSelected ? 'bg-primary/15 text-primary font-semibold' : 'hover:bg-muted/50 text-foreground/85'
        }`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFolder(node.slug)
            }}
            className="p-0.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => {
            if (node.page) onSelectPage(node.slug)
            else if (hasChildren) onToggleFolder(node.slug)
          }}
          className="flex-1 flex items-center gap-1.5 text-left truncate"
        >
          {isHome ? (
            <Home className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : hasChildren ? (
            <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div className="pl-3 space-y-0.5 border-l border-border/30 ml-3 mt-0.5">
          {node.children.map((child) => (
            <WikiItemNode
              key={child.slug}
              node={child}
              selectedSlug={selectedSlug}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onSelectPage={onSelectPage}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const WikiFolderItem = WikiItemNode
