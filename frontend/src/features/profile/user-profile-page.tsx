import { useParams, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User } from 'lucide-react'
import { UserProfileContent } from './user-profile-content'

export function UserProfilePage() {
  const { username } = useParams({ from: '/$rootSlug/users/$username' })
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      navigate({ to: '/' })
    }
  }

  if (!username) {
    return (
      <div className="container max-w-5xl mx-auto py-12 px-4 text-center">
        <User className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <h1 className="text-xl font-bold text-foreground">User Not Specified</h1>
        <p className="text-sm text-muted-foreground mt-1">Please provide a valid contributor username in the URL.</p>
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Breadcrumb / Back button */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>

        <div className="text-xs font-mono text-muted-foreground">
          Contributor Performance Hub
        </div>
      </div>

      {/* Main Profile Content */}
      <UserProfileContent username={username} isModal={false} />
    </div>
  )
}
