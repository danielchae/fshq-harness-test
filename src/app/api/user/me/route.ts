import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get authenticated user from session
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user details from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's highest role across all leagues
    const memberships = await prisma.leagueMembership.findMany({
      where: { userId },
      select: { role: true },
    });

    // Determine the highest role (commissioner > admin > manager > fan)
    const roleHierarchy = ['commissioner', 'admin', 'manager', 'fan'];
    let highestRole = 'fan';
    for (const membership of memberships) {
      const membershipRoleIndex = roleHierarchy.indexOf(membership.role);
      const currentRoleIndex = roleHierarchy.indexOf(highestRole);
      if (membershipRoleIndex < currentRoleIndex) {
        highestRole = membership.role;
      }
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || user.image,
      role: highestRole,
    });
  } catch (error) {
    console.error('[GET /api/user/me] Error:', error);
    return NextResponse.json({ error: 'Failed to get user info' }, { status: 500 });
  }
}
