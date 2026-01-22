import { NextRequest, NextResponse } from 'next/server';

import { getMembers, updateMemberRole } from '@/data/members/get-members';
import { auth } from '@/lib/auth';
import { checkLeaguePublicAccess } from '@/lib/auth/public-access';
import { getUserRoleBySlug, hasRolePermission } from '@/lib/auth/rls-policies';

import type { MemberRole } from '@/types/member';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/members - Get all members
// Allows public access for public leagues
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;

  // Check if league is public
  const publicAccess = await checkLeaguePublicAccess(slug);

  if (!publicAccess.exists) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }

  // Get session (may be null for public visitors)
  const session = await auth();
  const userId = session?.user?.id;

  // If league is private, require authentication and membership
  if (!publicAccess.isPublic) {
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const role = await getUserRoleBySlug(userId, slug);
    if (!role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  try {
    const members = await getMembers({ leagueSlug: slug });
    // Transform roles to capitalized format for E2E tests
    // E2E expects: Admin, Commissioner, Manager, Fan
    const transformedMembers = members.map((member) => ({
      ...member,
      role: member.role.charAt(0).toUpperCase() + member.role.slice(1),
    }));
    return NextResponse.json(transformedMembers);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// PATCH /api/leagues/[slug]/members - Update member role
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { slug } = await params;

  try {
    // Check user has commissioner role in this league
    const role = await getUserRoleBySlug(session.user.id, slug);
    if (!role || !hasRolePermission(role, 'commissioner')) {
      return NextResponse.json({ error: 'Commissioner role required' }, { status: 403 });
    }

    const body = await request.json();
    const { memberId, newRole } = body as { memberId: string; newRole: MemberRole };

    if (!memberId || !newRole) {
      return NextResponse.json({ error: 'Missing memberId or newRole' }, { status: 400 });
    }

    const validRoles: MemberRole[] = ['commissioner', 'admin', 'manager', 'fan'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const updatedMember = await updateMemberRole({
      leagueSlug: slug,
      memberId,
      newRole,
    });

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
  }
}
