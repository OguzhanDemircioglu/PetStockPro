# PLAN — PayTR + Nilvera Entegrasyonu (iyzico → PayTR geçişi)

> **Başlangıç:** 2026-06-09 · **Karar:** iyzico tamamen bırakıldı, PayTR (otomatik tekrarlayan ödeme) + Nilvera (test ortamı) kullanılacak.
> **Yenileme modeli:** İlk ödemede kart saklanır → her dönem cron ile PayTR'dan otomatik çekilir.
> Bkz. [[project_payment_paytr_nilvera]] (memory), `lib/billing/totals.ts` (korunan KDV/dönem helper'ları).

---

## 0. Özet kararlar

| Konu | Karar |
|---|---|
| Ödeme sağlayıcı | **PayTR** (iyzico çıkıyor) |
| Yenileme | **Otomatik** — kart token saklama + cron ile dönemsel charge |
| İlk ödeme | **iframe API** (PayTR hosted 3D sayfa, PCI bizden uzak) + `store_card=1` + `utoken` |
| Yenileme çekimi | **Direkt API recurring** (`POST /odeme`, `non_3d=1` + `recurring_payment=1`) |
| Fatura | **Nilvera e-Arşiv** (test: `apitest.nilvera.com`), her başarılı ödemede best-effort |
| Fiyat | PRO **1.000₺** (100000 kuruş) · PRO+ **2.000₺** (200000 kuruş), KDV %20 dahil |
| Para birimi | TL (TR-only) |
| KDV ayrıştırma | `computeInvoiceTotals` (mevcut, korunuyor) |

---

## 1. 🚨 Kritik bağımlılık — PayTR hesap yetkileri (RİSK)

Kart saklama + otomatik (Non3D) çekim, PayTR'da **hesap seviyesinde yetki** ister:

1. **Mağaza tipi: "Direkt API"** (sadece iframe yetmez)
2. **"Non3D ile ödeme" yetkisi** — PayTR'dan ayrıca onay/talep gerekir

**Sonuç:**
- **Faz 2 (ilk ödeme, iframe + kart saklama)** — bu yetki açık değilse bile iframe 3D ödeme çalışır; kart saklama yetkisi açıksa token döner.
- **Faz 3 (otomatik yenileme, Non3D recurring)** — bu yetki **açık olmadan ÇALIŞMAZ.** Test hesabında Non3D yoksa Faz 3 **yalnızca mock testlerle** doğrulanır; canlı recurring, yetki gelince smoke edilir.

> ⏳ **Kullanıcı aksiyonu:** PayTR Mağaza Paneli'nden "Kart Saklama" + "Non3D ile ödeme" yetkilerinin test ortamında açık olup olmadığını teyit et / talep et. Açık değilse Faz 3 canlı testi bu yetkiye bağlı (bloker değil — kod + mock testler hazır olur).

---

## 2. Mimari akış

### 2.1 İlk ödeme (checkout — Faz 2)
```
Tenant /admin/settings/billing → "PRO'ya yükselt"
  → server action: subscription 'incomplete' satırı + benzersiz merchant_oid üret
  → createPaytrIframeToken({ store_card:1, utoken:<companyId-türevi>, amount, basket })
  → iframe (paytr.com/odeme/guvenli/<token>) göster
Tenant kartı girer + "kartımı kaydet" → PayTR 3D doğrular
  → PayTR → /api/webhooks/paytr (callback POST)
       hash doğrula (merchant_oid+salt+status+total_amount)
       status=success:
         - subscription: active + period +1 ay + plan snapshot
         - kart token sakla (utoken/ctoken/maskeli PAN/marka)
         - company.plan = PRO/PRO_PLUS
         - invoice (pending) + Nilvera e-Arşiv (best-effort → issued)
         - audit + processed_webhooks(merchant_oid) idempotency
         - yanıt: "OK"  ← PayTR bunu bekler
       status=failed: subscription 'incomplete' kalır, audit, "OK"
```

### 2.2 Otomatik yenileme (cron — Faz 3)
```
Cloudflare cron (günlük) → /api/cron/billing-renew (CRON_SECRET)
  → due abonelikler: status IN (active,past_due) AND current_period_end <= now+grace AND NOT cancelAtPeriodEnd
  → her biri için chargeSavedCard(utoken, ctoken, amount, non_3d=1, recurring_payment=1)
       success → period +1 ay + invoice + Nilvera + retry sıfırla
       failed  → past_due + paymentRetryCount++ + nextRetryAt (1g→3g→5g)
       retry tükendi → suspended → (grace sonu) expired + company.plan=FREE
İptal (cancelAtPeriodEnd=true) → dönem sonunda charge YOK → expired
```

### 2.3 Callback güvenliği
- Hash uyuşmazsa **"OK" DÖNME** (sahte istek) — 400.
- Idempotency: `processed_webhooks.event_id = merchant_oid` (PK çakışması = skip).
- Tutar doğrulama: `total_amount` beklenen plan tutarıyla eşleşmeli (manipülasyon koruması).
- PayTR retry spam'ini önlemek için işlenmiş event'lerde de **"OK"** dön.

---

## 3. Şema değişiklikleri (Faz 2 migration)

### `subscriptions`
| İşlem | Alan |
|---|---|
| ❌ DROP | `iyzico_subscription_ref` (+ unique), `iyzico_customer_ref` |
| ➕ ADD | `paytr_utoken varchar(128)` — kullanıcı token (saklı kartlar sahibi) |
| ➕ ADD | `paytr_ctoken varchar(190)` — saklı kart token (recurring charge için) |
| ➕ ADD | `paytr_card_masked varchar(32)` — "•••• •••• •••• 1234" (UI) |
| ➕ ADD | `paytr_card_brand varchar(20)` — visa/mastercard/troy |
| ➕ ADD | `pending_merchant_oid varchar(64)` — devam eden ödeme eşleştirme (callback lookup) |
| ➕ ADD | `payment_retry_count int default 0` — dunning sayacı |
| ➕ ADD | `next_retry_at timestamptz` — sıradaki deneme |
| status | `subscriptionStatusEnum` mevcut yeterli (active/past_due/suspended/cancelled/expired/incomplete) — `incomplete` yoksa eklenir |

### `invoices`
| ➕ ADD | `merchant_oid varchar(64)` — başarılı ödeme → fatura eşleştirme |

### `processed_webhooks`
- Şema değişmez; `source` değeri `'paytr'`, `event_id` = `merchant_oid`.

> Migration **drizzle-kit generate** ile üretilir + `_journal`'a eklenir (CONCURRENTLY içermez → normal migrator uygular). `subscriptions` tablosu canlıda boş (henüz aktif abonelik yok) → DROP güvenli.

---

## 4. Fazlar

### Faz 0 — iyzico çıkar + Nilvera VKN düzelt (kod, **DDL yok**)
- `lib/nilvera/config.ts`: `NILVERA_SELLER_VKN` `.length(10)` → `^\d{10,11}$` (şahıs şirketi TCKN 11 hane) + test güncelle.
- Sil: `src/lib/iyzico/**`, `src/app/api/webhooks/iyzico/**`, `src/lib/billing/orchestrator.ts(+test)`.
- Koru: `lib/billing/totals.ts` (PayTR'da aynen kullanılacak).
- Doğrula: kırılan import yok, full test suite yeşil.

### Faz 1 — PayTR kütüphanesi (config+hash+client+types ✅ BİTTİ — kalan ekler)
- `hash.ts`: `buildPaytrRecurringHash` (recurring alan sırası farklı).
- `client.ts`: `createPaytrIframeToken`'a `storeCard`/`utoken`; `chargeSavedCard` (recurring); `listSavedCards` (utoken→ctoken).
- Testler (aşağıdaki matris).

### Faz 2 — Şema + checkout + ilk ödeme callback
- Migration (§3).
- `lib/billing/paytr-checkout.ts`: subscription incomplete + merchant_oid + token üret.
- `/admin/settings/billing` upgrade UI + iframe.
- `/api/webhooks/paytr/route.ts` callback (hash verify → orchestrator → "OK").
- `lib/billing/orchestrator.ts` (PayTR sürümü): `handleFirstPayment` + `handleRenewal` + invoice + Nilvera + audit + idempotency.

### Faz 3 — Recurring charge + yenileme cron + dunning
- `chargeSavedCard` entegrasyon.
- `/api/cron/billing-renew` + wrangler cron + CRON_SECRET.
- Dunning state machine (past_due → suspended → expired → FREE).

### Faz 4 — Abonelik UI + iptal + fatura geçmişi
- `/admin/settings/billing`: plan kartı + dönem + kart maskesi + iptal (cancelAtPeriodEnd) + fatura listesi (pdf indir) + past_due/suspended banner + "kartı güncelle".

### Faz 5 — Doküman + uçtan uca smoke + temizlik
- `PAYMENT-INTEGRATION.md` (iyzico→PayTR), yasal sayfa/footer "iyzico" metinleri.
- Browser smoke (test hesabı): checkout iframe + callback simülasyon + billing UI.
- `CLAUDE.md` + `DEVAM-REHBERI.md` güncelle.

---

## 5. 🧪 Test senaryo matrisi (her senaryo)

### 5.1 hash.ts (✅ 19 + recurring ekleri)
- ✅ token hash formül eşleşme / tamper(oid,amount) / salt / key / fail-fast (9)
- ✅ callback hash success/failed / status-tamper / amount-tamper / oid-tamper / forge-salt / boş / timing-safe kısa+uzun / key-eksik (10)
- ➕ recurring token hash: formül eşleşme (alan sırası) + tek-alan-değişim + salt/key

### 5.2 client.ts (✅ 11 + ekler)
- ✅ get-token success/endpoint/uçtan-uca-token/basket-base64/debug_on/failed/JSON-dışı/ağ/config-eksik + iframeUrl (11)
- ➕ get-token `store_card=1`+`utoken` body'de mevcut
- ➕ chargeSavedCard: success / `wait_callback` / failed+mesaj / ağ / config-eksik / non3d body alanları (`non_3d=1`,`recurring_payment=1`)
- ➕ listSavedCards: utoken→ctoken parse / boş liste / hata

### 5.3 Nilvera config (VKN düzeltme)
- ➕ 10 hane VKN kabul / **11 hane TCKN kabul** / 9 hane reddet / 12 hane reddet / harf reddet / boş→optional

### 5.4 Callback route `/api/webhooks/paytr`
- geçerli success hash → işlenir + **"OK"** + 200
- geçerli failed hash → subscription dokunulmaz/incomplete + audit + "OK"
- **geçersiz hash → "OK" DÖNMEZ** + 400 (sahte)
- duplicate merchant_oid → idempotent skip + "OK"
- bilinmeyen merchant_oid → crash yok + "OK" + log
- **tutar uyuşmazlığı** (total_amount ≠ plan) → reddet + alert
- kart token alanları DB'ye yazıldı
- Nilvera başarılı → invoice issued / Nilvera hata → invoice pending (akış bozulmaz)

### 5.5 Orchestrator (PayTR)
- ilk ödeme success → active + period+1 + invoice + Nilvera + company.plan + audit
- yenileme success → period+1 + invoice + retry sıfır
- yenileme failed → past_due + retryCount++ + nextRetryAt
- retry tükendi → suspended → expired + company.plan=FREE
- iptal (cancelAtPeriodEnd) → charge yok → expired
- idempotency (aynı merchant_oid iki kez)

### 5.6 Cron `/api/cron/billing-renew`
- due abonelikleri seçer (periodEnd<=now, active/past_due, not cancel)
- cancelled/expired atlar
- CRON_SECRET yanlış → 401
- charge success/fail dallarını tetikler (mock)

### 5.7 Billing UI (browser smoke + birim)
- upgrade button → token alır → iframe render
- iptal → confirm → status cancelled + "dönem sonuna kadar aktif" banner
- fatura listesi render + pdf link
- past_due banner + "kartı güncelle"
- plan limit: ödeme sonrası company.plan=PRO → ürün/vitrin limitleri değişir

### 5.8 Güvenlik / edge (özellikle)
- replay (duplicate callback) → idempotent
- forged callback (yanlış hash) → reddedilir
- race: aynı oid iki callback → unique constraint
- amount tampering → tutar doğrulama
- merchant_oid sadece alfanümerik (PayTR kısıtı)
- kart son kullanma geçti (recurring failed) → dunning → "kartı güncelle"

---

## 6. Kapsam dışı (Faz 2+ / tek geliştirici sade-tut)
- Proration (dönem ortası plan değişiminde gün hesabı) — upgrade'de yeni dönem başlat, iade yok.
- Otomatik iade / chargeback yönetimi (PayTR panelinden manuel).
- Çoklu para birimi / taksit (subscription tek çekim, no_installment).
- Paddle / yurt dışı (TR-only kararı korunur).
- Birden fazla saklı kart yönetimi (tek kart yeterli; ekstra kart Faz 2).

---

## 7. Env (referans)
```
PAYTR_MERCHANT_ID / PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT   # Mağaza Paneli → Bilgi
PAYTR_TEST_MODE=1                                              # 1 test / 0 canlı
PAYTR_BASE_URL=https://www.paytr.com
NILVERA_API_KEY / NILVERA_BASE_URL=https://apitest.nilvera.com # test
NILVERA_SELLER_VKN (10/11 hane) / NILVERA_SELLER_TITLE
CRON_SECRET                                                    # yenileme cron auth
```

---

## 8. İlerleme

| Faz | Durum |
|---|---|
| 1 (config+hash+client+types) | ✅ kısmen (30 test) — recurring ekleri kaldı |
| 0 (iyzico çıkar + Nilvera VKN) | ✅ iyzico+orchestrator+webhook silindi · VKN 10/11 hane · 1795 test · typecheck/lint 0 |
| 2 (şema+checkout+callback) | ⏳ |
| 3 (recurring+cron+dunning) | ⏳ |
| 4 (UI+iptal+fatura) | ⏳ |
| 5 (doc+smoke+temizlik) | ⏳ |
