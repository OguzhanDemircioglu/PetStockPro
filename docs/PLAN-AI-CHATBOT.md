# PetStockPro — AI Chatbot (Sol menüde "AI" sekmesi)

**Karar tarihi:** 2026-05-22
**Durum:** 📋 Plan onaylandı, implementation YENİ SESSION'da başlayacak
**Knowledge base:** [docs/USER-MANUAL.md](USER-MANUAL.md) (2413 satır, hazır)

---

## 1. Hedef

Kullanıcı (pet shop sahibi + çalışan) `/admin/ai` sayfasındaki chatbot'a doğal dilde soru sorabilsin:

- "Vitrin'e ürün nasıl çıkarırım?"
- "Stok hesabım yanlış görünüyor, ne yapayım?"
- "PRO'ya geçtikten sonra Excel import nasıl çalışır?"
- "Veresiye satışlarımı nereden takip ederim?"

Chatbot **sadece USER-MANUAL.md içeriğinden** cevap verir (RAG pattern). Kapsam dışı sorularda nazikçe reddeder ("Bu konuyla ilgili bilgim yok, destek@petstockpro.com'a yazabilirsin").

> **Hiçbir soru cevapsız kalmamalı** prensibi: USER-MANUAL 2413 satır + 55+ SSS + 15 troubleshooting senaryosu içerir. Kapsam dışı sorular destek email'ine yönlendirilir.

---

## 2. Stack Kararı (2026-05-22)

| Katman | Karar | Neden |
|---|---|---|
| **LLM** | **Cloudflare Workers AI** | Mevcut stack uyumu (zaten Workers'a deploy edeceğiz). `@cf/meta/llama-3.1-8b-instruct` veya `@cf/qwen/qwen1.5-14b-chat-awq` — TR destekli. Maliyet: usage-based, çok ucuz ($0.011 / 1K input token civarı). |
| **Embedding** | **Cloudflare Workers AI** (`@cf/baai/bge-base-en-v1.5` veya TR-friendly multilingual) | Aynı stack — tek API. TR text için `multilingual-e5-large` daha iyi olabilir, lansman öncesi test. |
| **Vector store** | **Cloudflare Vectorize** | Stack uyumu, ucuz (1M vector $0.04/ay), düşük latency (edge'de). pgvector alternatifi olabilirdi ama Supabase Frankfurt → Workers latency'i fazla. |
| **Erişim** | FREE 10 msg/gün, PRO + PRO+ sınırsız | Plan farklılaşması (Karar A revize 2026-05-22 ile uyumlu). Maliyet kontrolü. |
| **Rate-limit** | IP × tenant × user — günlük + dakika başına 5 msg | Spam koruma + maliyet kontrolü |
| **Auth** | Sadece authenticated user (BAYI_SAHIBI + OBSERVER + STAFF) | Müşteri (vitrin ziyaretçisi) kullanamaz — chatbot pet shop sahibi içindir |

---

## 3. Maliyet Tahmini

### MVP / Beta (50-100 tenant)
- Workers AI: ~50 mesaj/tenant/ay × 50 tenant = 2.500 mesaj/ay
- Ortalama input: 500 token + context retrieve 1.500 token = 2.000 input token
- Ortalama output: 200 token
- Maliyet: 2.500 × (2.000 input + 200 output) × $0.011/1K ≈ **$60/ay**
- Vectorize: 2.413 chunk × 768 dim ≈ 2K vector, query ~5K/ay = **$1/ay**
- **Toplam ~$60-65/ay**

### Scale (1K tenant)
- 50 mesaj × 1K tenant × %5 active = 50.000 mesaj/ay (PRO+PRO+ sınırsız)
- + 200 mesaj × 700 FREE × 10 cap = 14.000 mesaj/ay (cap'lenmiş)
- Toplam ~64.000 mesaj × ~2.2K token × $0.011/1K ≈ **$1.500-1.800/ay**
- Vectorize: küçük (10K query/ay) ≈ $5/ay
- **Toplam ~$1.500-1.800/ay**

Net gelir karşılaştırma: 1K tenant senaryosunda brüt ~350K₺/ay (~$11.600). AI maliyeti net gelirin %13-15'i. Yönetilebilir.

---

## 4. Implementation Fazları

### Faz 1: Knowledge base hazırlığı (1 saat)
- USER-MANUAL.md chunk'la (~500 token paragraflar, başlık metadata ile)
- Chunk script (`scripts/chunk-user-manual.ts`) — markdown header bazlı split
- JSON output (`scripts/data/user-manual-chunks.json`) → ~80-150 chunk

### Faz 2: Vectorize index + embedding (1.5 saat)
- Cloudflare Vectorize index create (CLI veya dashboard)
- Embedding API çağrısı (Workers AI) → her chunk için 768-dim vector
- Bulk upsert script (`scripts/seed-vectorize.ts`)
- Production'da deploy öncesi 1 kez çalıştırılır, sonra DOC değiştikçe re-seed

### Faz 3: RAG endpoint (2 saat)
- `/api/ai/chat` POST handler:
  1. User mesajı al + auth check
  2. Plan kontrolü (FREE 10/gün kontrolü, daily counter)
  3. Embedding (user mesajı → 768-dim vector)
  4. Vectorize query (top-5 most similar chunks)
  5. System prompt + retrieved chunks + user message → Workers AI LLM
  6. Stream response (Server-Sent Events veya regular fetch)
  7. Audit log + usage counter increment

### Faz 4: UI — `/admin/ai` sayfası (2 saat)
- Sidebar menü: "🤖 AI Asistanı" link (Pano altında)
- Chat interface (ChatGPT-tarzı):
  - Üst başlık + welcome message ("Merhaba! PetStockPro hakkında her şeyi sorabilirsin.")
  - Mesaj listesi (user/assistant balonları)
  - Input + send button (Enter ile gönder)
  - Typing indicator (LLM cevap üretirken)
  - "Önerilen sorular" başlangıçta (FAQ'dan 5 öneri)
- TanStack Query ile state
- FREE plan'da "Bugün 7/10 mesaj kullandın" sayacı

### Faz 5: Plan gate + rate-limit (1 saat)
- `ai_usage` tablo (companyId + userId + date + count)
- FREE 10/gün cap → 11. mesaj reject "FREE planında günde 10 soru sorabilirsin"
- IP × dakika rate-limit (5 msg/dk) — anti-spam
- `getEffectiveAiQuota(plan)` helper

### Faz 6: Test + smoke (1 saat)
- Unit test: chunk splitter + plan gate + retrieval ranking
- Browser smoke: FREE user 10 mesaj sonra 11. reject, PRO user sınırsız, kapsam dışı soru reddet
- Cost simulation: 100 mesaj test → Workers AI bill kontrol

### Faz 7: Doc + monitoring (30 dk)
- USER-MANUAL.md'ye chatbot bölümü ekle
- system_errors tablosuna AI hata kaydı (Workers AI timeout, Vectorize fail, vs.)
- Süperadmin paneli mini AI istatistik (toplam soru/gün, ortalama yanıt süresi)

**Toplam: 8-9 saat** — 2 büyük tur yeterli.

---

## 5. Schema değişiklikleri

### Yeni tablo: `ai_usage`
```typescript
export const aiUsage = petstockproSchema.table('ai_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Günlük aggregate satır (gün başına 1 satır/user)
  date: date('date').notNull(),
  messageCount: integer('message_count').notNull().default(0),
  totalInputTokens: integer('total_input_tokens').notNull().default(0),
  totalOutputTokens: integer('total_output_tokens').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_ai_usage_company_user_date').on(t.companyId, t.userId, t.date),
]);
```

### Yeni tablo: `ai_messages` (audit + analytics)
```typescript
export const aiMessages = petstockproSchema.table('ai_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
  role: aiMessageRoleEnum('role').notNull(),  // 'user' | 'assistant'
  content: text('content').notNull(),
  // RAG metadata
  retrievedChunkIds: jsonb('retrieved_chunk_ids'),  // ['c-001', 'c-042', ...]
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  modelUsed: varchar('model_used', { length: 100 }),  // '@cf/meta/llama-3.1-8b-instruct'
  responseTimeMs: integer('response_time_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_ai_messages_company_date').on(t.companyId, t.createdAt),
]);
```

Migration: `0027_ai_chatbot.sql` — yeni 2 tablo + 1 enum.

---

## 6. Env değişkenleri

```bash
# Cloudflare Workers AI (production)
CLOUDFLARE_ACCOUNT_ID=                # Cloudflare dashboard'tan
CLOUDFLARE_API_TOKEN=                 # Workers AI + Vectorize yetkisi

# Vectorize index ID (deploy sonrası)
CLOUDFLARE_VECTORIZE_INDEX=petstockpro-user-manual

# AI Plan limit (default override için)
AI_FREE_DAILY_LIMIT=10                # default 10, env ile override
AI_RATE_LIMIT_PER_MINUTE=5            # IP × user
```

---

## 7. UX detayları

### Welcome screen (boş chat)
```
🤖 Merhaba! Ben PetStockPro AI Asistanı.

PetStockPro hakkında her türlü soruyu sorabilirsin:
• "Vitrin'e ürün nasıl çıkarırım?"
• "Stok 0 olduğunda ne oluyor?"
• "PRO'ya nasıl geçerim?"
• "Excel ile toplu ürün eklemek istiyorum"

[Önerilen sorular — tıkla başla]
[🛒 Stok takibi] [🏪 Vitrin yönetimi] [💳 Plan & Fatura]
[👥 Kullanıcı yetkileri] [📊 Raporlar]
```

### Mesaj formatları
- **User balonu:** Sağ, turuncu (cat color)
- **Assistant balonu:** Sol, beyaz, markdown rendering (kod blok + tablo + link)
- **Typing indicator:** "🤖 düşünüyor..." 3 nokta animasyon
- **Hata mesajı:** "Üzgünüm, bir sorun oluştu. Tekrar dene veya destek@petstockpro.com'a yaz."
- **Kapsam dışı:** "Bu konuyla ilgili bilgim yok. PetStockPro'nun kendi özellikleri dışında bir soru sorduysan destek@petstockpro.com'a yazabilirsin."

### FREE plan limit UX
- Sidebar'da "🤖 AI (7/10 bugün)" sayaç (yeşil → turuncu → kırmızı tone)
- 10/10'a ulaşınca input disabled + "Günlük limitin doldu. Yarın saat 00:00'da sıfırlanacak — veya PRO'ya geç sınırsız sor."
- PRO+'da sayaç gizli

### Önerilen sorular
- 5 kategori × 3-5 soru = 15-25 prompt
- Her kategori başlangıçta görünür, tıklanınca input'a yazılır + auto-submit

---

## 8. Risk + Alternatif

| Risk | Mitigation |
|---|---|
| LLM TR yetersiz cevap | Llama 3.1 8B + system prompt güçlü "Türkçe cevap ver" instruction + örnek few-shot. Test gerekli, alternatif: `@cf/qwen/qwen2.5-coder-32b-instruct` |
| Vectorize retrieval kötü top-5 | Embedding model TR-friendly (multilingual-e5-large) test. Re-rank ekle (BM25 hybrid). |
| Cloudflare AI timeout | 10 sn timeout cap + fallback "Sistem yoğun, biraz sonra tekrar dene" |
| Hallucination (yanlış bilgi) | System prompt: "Eğer USER-MANUAL'de bulamadıysan 'bilmiyorum' de, asla uydurma". Retrieved chunks'ı response'da link olarak göster. |
| Maliyet patlaması | FREE 10/gün + PRO sınırsız ama dakika başına 5 cap + günlük tenant başı 500 cap (savunmacı). Süperadmin alert. |
| Knowledge base eskime | USER-MANUAL.md değişirse vectorize re-seed gerek. CI'da otomatik re-seed (manual.md değiştiğinde) |

---

## 9. Sıradaki adım (yeni session)

```bash
cd D:\Projeler\PetStockPro
claude
İlk komut: "PLAN-AI-CHATBOT.md oku ve Faz 1'den başla"
```

İlk turda yapılacak (Faz 1-3, ~4.5 saat):
1. Chunk script + JSON output (Faz 1)
2. Cloudflare Vectorize setup + embedding + bulk upsert (Faz 2)
3. `/api/ai/chat` RAG endpoint (Faz 3)

İkinci turda yapılacak (Faz 4-7, ~4.5 saat):
4. UI sayfa + sidebar link
5. Plan gate + rate-limit
6. Test + browser smoke
7. Doc + monitoring

---

*Son güncelleme: 2026-05-22 — kullanıcı kararıyla. Implementation YENİ SESSION'da.*
