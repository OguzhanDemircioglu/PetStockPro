import 'dotenv/config';
import { askWithContext } from '../src/lib/ai/rag';

(async () => {
  const r = await askWithContext('petstockpro-user-manual', 'AI Asistanın günlük limiti ne kadar?');
  console.log('Answer:', r.answer);
  console.log('Sources:');
  r.retrievedChunks.forEach((c, i) =>
    console.log(`  ${i + 1}. [${c.score.toFixed(3)}] ${c.id}: ${c.breadcrumb}`),
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
