'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { markAsRead, markAllAsRead } from '@/lib/notifications/manage';

export async function markAsReadAction(notificationId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  await markAsRead(session.user.companyId, session.user.id, notificationId, db);
  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
}

export async function markAllAsReadAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.companyId || !session.user.id) redirect('/login' as never);

  await markAllAsRead(session.user.companyId, session.user.id, db);
  revalidatePath('/admin/notifications');
  revalidatePath('/admin');
}
