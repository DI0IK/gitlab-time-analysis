import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PieChart } from 'lucide-react'

interface CategoryItem {
  category_id: string
  label: string
  short_code: string
  color: string
  total_seconds: number
  total_hours: number
  percentage: number
}

interface GroupCategoriesCardProps {
  categories: CategoryItem[]
}

export function GroupCategoriesCard({ categories }: GroupCategoriesCardProps) {
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PieChart className="h-4 w-4 text-primary" />
          Engineering Activity Breakdown
        </CardTitle>
        <CardDescription className="text-xs">
          Automatic categorization based on issue labels and work logs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Visual segmented bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40 p-0.5 gap-0.5">
          {categories.map((c) => {
            if (c.percentage <= 0) return null
            return (
              <div
                key={c.category_id}
                style={{ width: `${c.percentage}%`, backgroundColor: c.color }}
                className="h-full rounded-xs transition-all duration-300"
                title={`${c.label}: ${c.percentage}% (${c.total_hours}h)`}
              />
            )
          })}
        </div>

        {/* Categories list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {categories.map((c) => (
            <div
              key={c.category_id}
              className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/30 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="font-medium text-foreground truncate">{c.label}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                <span className="text-muted-foreground">{c.total_hours}h</span>
                <span className="font-semibold text-foreground">{c.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
