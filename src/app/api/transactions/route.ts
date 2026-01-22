import { NextResponse } from 'next/server';

import { getTransactions } from '@/data/transactions/get-transactions';

import type { TransactionType } from '@/types/transactions';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueSlug = searchParams.get('leagueSlug') || '';
    const cursor = searchParams.get('cursor') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const type = (searchParams.get('type') as TransactionType) || undefined;
    const teamId = searchParams.get('teamId') || undefined;
    const playerSearch = searchParams.get('playerSearch') || undefined;

    const data = await getTransactions({
      leagueSlug,
      cursor,
      limit,
      type,
      teamId,
      playerSearch,
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
