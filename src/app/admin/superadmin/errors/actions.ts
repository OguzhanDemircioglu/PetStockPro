'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db/client';
import { requireSuperadmin } from '@/lib/superadmin/access';
import { setErrorResolved } from '@/lib/errors/list';

export async function resolveErrorAction(formData: FormData): Promise<void> {
  const session = await requireSuperadmin();
  const errorId = String(formData.get('errorId') ?? '');
  const resolved = String(formData.get('resolved') ?? '0') === '1';
  if (!errorId) return;
  await setErrorResolved(db, errorId, session.user!.id!, resolved);
  revalidatePath('/admin/superadmin/errors');
}
