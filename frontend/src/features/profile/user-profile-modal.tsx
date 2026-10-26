import { Modal } from '@/components/ui/modal'
import { UserProfileContent } from './user-profile-content'

interface UserProfileModalProps {
  username: string | null
  onClose: () => void
}

export function UserProfileModal({ username, onClose }: UserProfileModalProps) {
  if (!username) return null

  return (
    <Modal
      isOpen={Boolean(username)}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      title={
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-foreground">Contributor Profile</span>
          <span className="text-xs font-mono text-muted-foreground">@{username}</span>
        </div>
      }
    >
      <UserProfileContent username={username} isModal onClose={onClose} />
    </Modal>
  )
}
