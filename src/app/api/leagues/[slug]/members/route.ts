import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { getMembers, updateMemberRole } from '@/data/members/get-members';

import type { MemberRole } from '@/types/member';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/members - Get all members
export async function GET(request: NextRequest, { params }: RouteContext) {
  // Check authentication via session token cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('authjs.session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;

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
  // Check authentication via session token cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('authjs.session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;

  try {
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
