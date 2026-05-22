import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import { getTodayUsage } from '@/lib/ai/usage';
import { getEffectiveAiQuota, type PlanName } from '@/lib/ai/plan-gate';
import { getCompanyById } from '@/lib/cache/request-scoped';
import { ChatInterface } from './chat-interface';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AiPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    redirect('/login' as never);
  }

  const [usage, company] = await Promise.all([
    getTodayUsage(db, session.user.companyId, session.user.id),
    getCompanyById(session.user.companyId),
  ]);
  const plan = (company?.plan ?? 'FREE') as PlanName;
  const limit = getEffectiveAiQuota(plan);
  const isFreePlan = plan === 'FREE';
  const remaining = isFreePlan ? Math.max(0, limit - usage.messageCount) : null;

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
          {isFreePlan ? (
            <>
              <span>FREE plan: </span>
              <span
                className={`font-mono font-bold ${remaining! <= 2 ? 'text-danger' : remaining! <= 5 ? 'text-amber-600' : 'text-ink'}`}
              >
                {usage.messageCount}/{limit}
              </span>
              <span> bugün</span>
            </>
          ) : (
            <>
              <span>{plan} plan: </span>
              <span className="font-mono font-bold text-ink">{usage.messageCount}</span>
              <span> bugün (sınırsız)</span>
            </>
          )}
        </div>
      </header>
      <ChatInterface
        userName={(session.user.email ?? '').split('@')[0] || 'kullanıcı'}
        plan={plan}
        initialUsage={usage.messageCount}
        dailyLimit={isFreePlan ? limit : null}
      />
    </main>
  );
}
