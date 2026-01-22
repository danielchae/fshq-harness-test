// User league types for league switcher and navigation

import type { MembershipRole } from '@prisma/client';

export interface UserLeague {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  // Extended fields from task-31 acceptance criteria
  role?: MembershipRole;
  teamId?: string | null;
  teamName?: string | null;
}
