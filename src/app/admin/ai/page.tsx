import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getTodayUsage } from '@/lib/ai/usage';
import { ChatInterface } from './chat-interface';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AiPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    redirect('/login' as never);
  }

  // Günlük usage — FREE plan sayaç UI'sı için (Faz 5 plan gate'i tetiklenmeden bilgi göster)
  const usage = await getTodayUsage(db, session.user.companyId, session.user.id);

  return (
    <main className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-4xl flex-col gap-3 px-4 py-4">
      <header className="flex items-center justify-between border-b border-line/40 pb-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink">
            🤖 PetStockPro AI Asistanı
          </h1>
          <p className="text-[12.5px] text-ink-4">
            Uygulamayla ilgili her şeyi sorabilirsin. Cevaplar resmi kullanım kılavuzundan.
          </p>
        </div>
        <div className="text-right text-[11.5px] text-ink-4">
          Bugünkü mesajlar: <span className="font-mono font-bold text-ink">{usage.messageCount}</span>
        </div>
      </header>
      <ChatInterface
        userName={(session.user.email ?? '').split('@')[0] || 'kullanıcı'}
      />
    </main>
  );
}
