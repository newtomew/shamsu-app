// GET /api/analytics — portfolio-wide analytics for the logged-in creator
// (PRD section 2.4): usage over time, top buyers, daily earnings by buyer,
// error logs. Everything is scoped to the session user's own APIs.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getUsageOverTime, getTopBuyers, getDailyEarningsByBuyer, getErrorLogs, getRecentActivity } from '@/lib/creatorData';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const days = Number(req.nextUrl.searchParams.get('days')) || 14;

  const [usageOverTime, topBuyers, dailyEarningsByBuyer, errorLogs, recentActivity] = await Promise.all([
    getUsageOverTime(user.id, days),
    getTopBuyers(user.id),
    getDailyEarningsByBuyer(user.id, days),
    getErrorLogs(user.id),
    getRecentActivity(user.id),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      usage_over_time: usageOverTime,
      top_buyers: topBuyers,
      daily_earnings_by_buyer: dailyEarningsByBuyer,
      error_logs: errorLogs,
      recent_activity: recentActivity,
    },
  });
}
