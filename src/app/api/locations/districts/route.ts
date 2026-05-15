import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { districts } from '@/db/schema';

/**
 * GET /api/locations/districts?cityId=N
 *
 * Onboarding wizard'da il seçildikten sonra ilçe listesi için.
 * Public — cities/districts public read RLS policy ile uyumlu.
 */
export async function GET(req: NextRequest) {
  const cityIdParam = req.nextUrl.searchParams.get('cityId');
  const cityId = cityIdParam ? parseInt(cityIdParam, 10) : NaN;

  if (!Number.isFinite(cityId) || cityId < 1 || cityId > 81) {
    return NextResponse.json({ error: 'Invalid cityId' }, { status: 400 });
  }

  const rows = await db
    .select({ id: districts.id, name: districts.name })
    .from(districts)
    .where(eq(districts.cityId, cityId))
    .orderBy(districts.name);

  return NextResponse.json(rows);
}
