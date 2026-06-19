'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { withTenant } from '@/lib/db/with-tenant';
import { markAsRead, markAllAsRead } from '@/lib/notifications/manage';

export async function markAsReadAction(notificationId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);
  const companyId = session.user.companyId;
  const userId = session.user.id;

  await withTenant(companyId, (tx) => markAsRead(companyId, userId, notificationId, tx));
  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
}

export async function markAllAsReadAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);
  const companyId = session.user.companyId;
  const userId = session.user.id;

  await withTenant(companyId, (tx) => markAllAsRead(companyId, userId, tx));
  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
}
