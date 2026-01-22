import { Users } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { MembersList } from '@/components/members/members-list';
import { SettingsAccessDenied } from '@/components/settings/settings-access-denied';
import { getMembers } from '@/data/members/get-members';
import { getUserRole, hasRole } from '@/lib/auth/get-user-role';

interface MembersPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { slug } = await params;

  // Check user role for access - must be admin or higher
  const userRole = await getUserRole(slug);
  const isAdmin = hasRole(userRole, 'admin');

  // If not admin, show access denied
  if (!isAdmin) {
    return <SettingsAccessDenied leagueSlug={slug} />;
  }

  // Fetch members data (pending members are fetched client-side for testability)
  const members = await getMembers({ leagueSlug: slug });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Member Management"
        description="Manage league members, approve requests, and assign roles"
      />
      <MembersList leagueSlug={slug} initialMembers={members} />
    </div>
  );
}
