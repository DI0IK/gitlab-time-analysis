import * as React from 'react'

export interface ScopedBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  label: string
  color?: string | null
  size?: 'xs' | 'sm' | 'md'
}

/**
 * Parses a GitLab label string into scope and value.
 * e.g. "Category::implementation" -> { scope: "Category", value: "implementation", isScoped: true }
 */
export function parseScopedLabel(labelStr: string): {
  scope: string | null
  value: string
  isScoped: boolean
} {
  const trimmed = (labelStr || '').trim()
  if (trimmed.includes('::')) {
    const [scope, ...rest] = trimmed.split('::')
    return {
      scope: scope.trim(),
      value: rest.join('::').trim(),
      isScoped: true,
    }
  }
  // Also support single colon if followed by word (e.g. "type:bug")
  const colonMatch = trimmed.match(/^([A-Za-z0-9_-]+):([A-Za-z0-9_\s-]+)$/)
  if (colonMatch) {
    return {
      scope: colonMatch[1].trim(),
      value: colonMatch[2].trim(),
      isScoped: true,
    }
  }
  return {
    scope: null,
    value: trimmed,
    isScoped: false,
  }
}

/**
 * Returns a curated palette color if no hex is provided.
 */
function getHarmoniousColor(scopeOrTitle: string): string {
  const lower = scopeOrTitle.toLowerCase()
  if (lower.includes('pm') || lower.includes('project')) return '#ff7300'
  if (lower.includes('req') || lower.includes('re')) return '#8884d8'
  if (lower.includes('impl') || lower.includes('dev')) return '#10b981'
  if (lower.includes('arch') || lower.includes('design')) return '#f59e0b'
  if (lower.includes('bug') || lower.includes('fix') || lower.includes('critical')) return '#ef4444'
  if (lower.includes('doc') || lower.includes('spec')) return '#06b6d4'
  if (lower.includes('test') || lower.includes('qa')) return '#8b5cf6'
  if (lower.includes('p1') || lower.includes('priority')) return '#ec4899'

  // Stable string hash to pick consistent pleasant color
  let hash = 0
  for (let i = 0; i < lower.length; i++) {
    hash = (hash << 5) - hash + lower.charCodeAt(i)
    hash |= 0
  }
  const palette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1']
  return palette[Math.abs(hash) % palette.length]
}

export const ScopedBadge = React.forwardRef<HTMLSpanElement, ScopedBadgeProps>(
  ({ label, color, size = 'sm', className = '', style = {}, ...props }, ref) => {
    const { scope, value, isScoped } = React.useMemo(() => parseScopedLabel(label), [label])
    const baseColor = color && color.startsWith('#') ? color : getHarmoniousColor(scope || value)

    const sizeClasses = {
      xs: {
        container: 'text-[10px] leading-tight rounded-sm',
        scope: 'px-1.5 py-0.5 text-[9px]',
        value: 'px-1.5 py-0.5 text-[10px]',
        single: 'px-1.5 py-0.5 text-[10px]',
      },
      sm: {
        container: 'text-xs leading-none rounded-md',
        scope: 'px-2 py-1 text-[10px]',
        value: 'px-2 py-1 text-xs',
        single: 'px-2 py-1 text-xs',
      },
      md: {
        container: 'text-sm leading-normal rounded-lg',
        scope: 'px-2.5 py-1 text-[11px]',
        value: 'px-2.5 py-1 text-sm',
        single: 'px-2.5 py-1 text-sm',
      },
    }[size]

    if (isScoped && scope) {
      return (
        <span
          ref={ref}
          className={`inline-flex items-stretch overflow-hidden border shadow-2xs font-sans transition-all duration-150 hover:brightness-105 select-none ${sizeClasses.container} ${className}`}
          style={{
            borderColor: `${baseColor}40`,
            backgroundColor: `${baseColor}12`,
            ...style,
          }}
          {...props}
        >
          {/* Scope Key pill */}
          <span
            className={`font-mono uppercase tracking-wider font-semibold border-r flex items-center justify-center bg-black/10 dark:bg-white/10 text-muted-foreground ${sizeClasses.scope}`}
            style={{
              borderColor: `${baseColor}30`,
            }}
          >
            {scope}
          </span>

          {/* Value pill */}
          <span
            className={`font-semibold tracking-normal flex items-center justify-center ${sizeClasses.value}`}
            style={{
              color: baseColor,
            }}
          >
            {value}
          </span>
        </span>
      )
    }

    // Regular Non-Scoped Label
    return (
      <span
        ref={ref}
        className={`inline-flex items-center font-semibold border shadow-2xs transition-all duration-150 hover:brightness-105 select-none ${sizeClasses.container} ${sizeClasses.single} ${className}`}
        style={{
          borderColor: `${baseColor}40`,
          backgroundColor: `${baseColor}14`,
          color: baseColor,
          ...style,
        }}
        {...props}
      >
        {value}
      </span>
    )
  }
)

ScopedBadge.displayName = 'ScopedBadge'
