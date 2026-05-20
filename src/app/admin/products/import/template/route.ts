import { auth } from '@/lib/auth/auth';
import { buildImportTemplate } from '@/lib/products/import-template';

export async function GET() {
  const session = await auth();
  if (!session?.user?.companyId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const buffer = await buildImportTemplate();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="urun-import-sablonu.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
