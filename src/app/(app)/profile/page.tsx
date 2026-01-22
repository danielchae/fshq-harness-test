import { ProfileContent } from '@/components/profile/ProfileContent';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Profile',
  description: 'Manage your profile settings, view your stats, and customize your FSHQ.gg experience',
  path: '/profile',
});

export default function ProfilePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="sr-only">User Profile</h1>
      <ProfileContent />
    </div>
  );
}
