import { NextResponse } from 'next/server';

import { getMomentDetail } from '@/data/moments/get-moment-detail';

interface RouteContext {
  params: Promise<{ momentId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { momentId } = await context.params;

  const moment = await getMomentDetail({ momentId });

  if (!moment) {
    return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
  }

  return NextResponse.json(moment);
}
