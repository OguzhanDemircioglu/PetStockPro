/**
 * GET /api/catalog/search?q=...&limit=8
 *
 * Tenant kullanıcıları için curated seed katalog araması. /admin/products/new
 * formu autocomplete tüketicisidir.
 *
 * Auth: signed-in user (session.user.id zorunlu); rol kontrolü gereksiz (tüm
 * tenant kullanıcıları katalog'a erişebilir).
 *
 * Response:
 * ```
 * { results: SearchResult[], meta: { count: number, query: string } }
 * ```
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { searchSeedCatalog } from '@/lib/catalog/seed-catalog';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '8', 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 8;

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], meta: { count: 0, query: q } });
  }

  const results = await searchSeedCatalog(q, limit);

  return NextResponse.json(
    { results, meta: { count: results.length, query: q } },
    {
      headers: {
        // Aynı tenant aynı q için 30 sn cache; daha sonra yeniden fetch
        'Cache-Control': 'private, max-age=30',
      },
    },
  );
}
