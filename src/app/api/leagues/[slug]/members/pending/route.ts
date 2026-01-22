import { NextResponse } from 'next/server';

import { approveMember, denyMember, getPendingMembers } from '@/data/members/get-members';
import { auth } from '@/lib/auth';
import { getUserRoleBySlug, hasRolePermission } from '@/lib/auth/rls-policies';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// GET /api/leagues/[slug]/members/pending - Get pending membership requests
export async function GET(_request: Request, { params }: RouteContext) {
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

    const pendingMembers = await getPendingMembers({ leagueSlug: slug });
    return NextResponse.json(pendingMembers);
  } catch (error) {
    console.error('Error fetching pending members:', error);
    return NextResponse.json({ error: 'Failed to fetch pending members' }, { status: 500 });
  }
}

// POST /api/leagues/[slug]/members/pending - Approve a pending member
export async function POST(request: Request, { params }: RouteContext) {
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
    const { pendingMemberId, action } = body as { pendingMemberId: string; action: 'approve' | 'deny' };

    if (!pendingMemberId || !action) {
      return NextResponse.json({ error: 'Missing pendingMemberId or action' }, { status: 400 });
    }

    if (action === 'approve') {
      const approvedMember = await approveMember({
        leagueSlug: slug,
        pendingMemberId,
      });
      return NextResponse.json({ success: true, member: approvedMember });
    } else if (action === 'deny') {
      await denyMember({
        leagueSlug: slug,
        pendingMemberId,
      });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing pending member:', error);
    return NextResponse.json({ error: 'Failed to process pending member' }, { status: 500 });
  }
}
