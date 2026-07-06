import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [{ now }] = await db.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`;
    const userCount = await db.user.count();
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      timestamp: now,
      userCount,
    });
  } catch (error) {
    console.error('[health] db error:', error);
    return NextResponse.json(
      { status: 'error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
