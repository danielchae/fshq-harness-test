// Types for member management

export type MemberRole = 'commissioner' | 'admin' | 'manager' | 'fan';

export interface LeagueMember {
  id: string;
  userId: string;
  leagueId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: MemberRole;
  teamName?: string;
  joinedAt: string;
  lastActive?: string;
}

export interface PendingMember {
  id: string;
  userId: string;
  leagueId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  requestedAt: string;
  message?: string;
}

export interface MemberRoleUpdate {
  memberId: string;
  newRole: MemberRole;
}
