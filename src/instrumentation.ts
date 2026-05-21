/**
 * Next.js instrumentation hook — boot sırasında (Node.js runtime'da) çalışır.
 * Edge runtime'da skip edilir (postgres-js + fs erişimi yok).
 *
 * Otoritatif: docs/PLAN-BETA-PERFORMANCE.md FAZ 1
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.BOOTSTRAP_SKIP === '1') {
    console.log('[bootstrap] BOOTSTRAP_SKIP=1 — atlandı');
    return;
  }
  try {
    const { runBootstrap } = await import('./lib/bootstrap/run');
    await runBootstrap();
  } catch (err) {
    console.error('[bootstrap] ❌ FATAL:', err);
    // Boot fail explicit — Next.js start error.
    throw err;
  }
}
