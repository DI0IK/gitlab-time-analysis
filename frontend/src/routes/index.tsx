import { createFileRoute } from '@tanstack/react-router'
import { ComparisonView } from '@/features/analytics/comparison'

export const Route = createFileRoute('/')({
  component: ComparisonView,
})
