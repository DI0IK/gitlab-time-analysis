export interface CategoryMeta {
  id: string
  label: string
  shortCode: string
  color: string
}

export const CATEGORY_COLORS = {
  pm: '#ff7300',
  re: '#8884d8',
  impl: '#82ca9d',
  arch: '#ffc658',
  other: '#94a3b8',
} as const

export const DEFAULT_CATEGORY_METAS: Record<string, CategoryMeta> = {
  'project-management': {
    id: 'project-management',
    label: 'Project Management',
    shortCode: 'PM',
    color: CATEGORY_COLORS.pm,
  },
  'requirements-engineering': {
    id: 'requirements-engineering',
    label: 'Requirements Engineering',
    shortCode: 'RE',
    color: CATEGORY_COLORS.re,
  },
  implementation: {
    id: 'implementation',
    label: 'Implementation',
    shortCode: 'Impl',
    color: CATEGORY_COLORS.impl,
  },
  architecture: {
    id: 'architecture',
    label: 'Architecture',
    shortCode: 'Arch',
    color: CATEGORY_COLORS.arch,
  },
  other: {
    id: 'other',
    label: 'Other',
    shortCode: 'Other',
    color: CATEGORY_COLORS.other,
  },
}

export const CATEGORY_SHIFT_CONFIG = [
  { key: 'pm_hours', label: 'PM', color: CATEGORY_COLORS.pm, bgClass: 'bg-orange-500' },
  { key: 're_hours', label: 'Req Eng', color: CATEGORY_COLORS.re, bgClass: 'bg-indigo-400' },
  { key: 'impl_hours', label: 'Impl', color: CATEGORY_COLORS.impl, bgClass: 'bg-emerald-400' },
  { key: 'arch_hours', label: 'Arch', color: CATEGORY_COLORS.arch, bgClass: 'bg-amber-400' },
  { key: 'other_hours', label: 'Other', color: CATEGORY_COLORS.other, bgClass: 'bg-slate-400' },
] as const

export function getCategoryColor(scopeOrTitle: string): string {
  const lower = (scopeOrTitle || '').toLowerCase()
  if (lower.includes('pm') || lower.includes('project')) return CATEGORY_COLORS.pm
  if (lower.includes('req') || lower.includes('re') || lower.includes('requirement')) return CATEGORY_COLORS.re
  if (lower.includes('impl') || lower.includes('dev') || lower.includes('implement')) return CATEGORY_COLORS.impl
  if (lower.includes('arch') || lower.includes('design')) return CATEGORY_COLORS.arch
  return CATEGORY_COLORS.other
}
