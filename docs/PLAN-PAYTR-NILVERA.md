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
- `client.ts`: `createPaytrIframeToken`'a `storeCard`/`utoken`; `chargeSavedCard` (recurring); `listSavedCards` (utoken→ctoken). **⚠ PayTR `/odeme/capi/list` biçimi (2026-07-03 fix):** BAŞARIDA kartların **DÜZ DİZİSİni** döndürür (`[{ctoken, last_4, ...}]`, üstte `status`/`cards` sarmalı YOK — resmi doc: kayitli-kart-listesi); boş eşleşme `{}`/`[]`; hata `{status:'error', err_msg}`. `listSavedCards` bu polimorfik biçimleri normalize eder. Eski Zod şeması `{status, cards}` OBJESİ bekliyordu → gerçek başarı DİZİSİNİ reddedip `"beklenmedik yanıt biçimi (HTTP 200)"` throw ediyordu (PRO→PRO+ upgrade patlıyordu). Ayrıca `chargeSavedCard`/`listSavedCards` ağ/parse/config hatasında `PaytrApiError` THROW eder → **çağıran server action MUTLAKA try/catch** olmalı (yoksa ham 500 + error-boundary çökmesi).
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
| 1 (config+hash+client+types) | ✅ TAM — recurring hash + chargeSavedCard + store_card/utoken · 42 PayTR test |
| 0 (iyzico çıkar + Nilvera VKN) | ✅ iyzico+orchestrator+webhook silindi · VKN 10/11 hane · 1795 test · typecheck/lint 0 |
| 2 şema | ✅ Supabase+Aiven (0029) |
| 2 orchestrator | ✅ processPaytrCallback (transaction'lı) + 12 test |
| 2 callback route | ✅ /api/webhooks/paytr + 8 test |
| 2 checkout backend | ✅ paytr-checkout + 5 test |
| 2 billing UI | ✅ /admin/settings/billing — **E2E doğrulandı** (gerçek PayTR get-token + iframe + incomplete subscription) |
| 3 (recurring+cron+dunning) | ✅ listSavedCards + runBillingRenewals + /api/cron/billing-renew + wrangler cron · 22 test |
| 4 (iptal + reactivate) | ✅ cancel/reactivate + UI · E2E (reactivate → DB cancel=false doğrulandı) · 4 test |
| 5 (doc + metin temizliği) | ✅ iyzico→PayTR (legal/landing/superadmin/env panel) + PAYMENT-INTEGRATION not · 1858 test |
| Hardening (C1-C4 / I1-I3 / H1-H2) | ✅ plan `precious-popping-mochi` — aşağıda §9 |
| Nilvera canlı fatura — VKN doğrulama + e-Fatura/e-Arşiv/nihai tüketici yönlendirme | ✅ 2026-06-19 — aşağıda §10 · 1916 test |

---

## 9. Ödeme Sağlamlaştırma (2026-06-11, plan: precious-popping-mochi)

Uçtan uca denetim sonrası kapatılan açıklar + eklenen gözlemlenebilirlik.

### 9.1 Anomali → alert → aksiyon
Süperadmin Telegram alert'leri: `src/lib/billing/alerts.ts` (fire-and-forget, tx DIŞINDA).

| Durum | Davranış | Süperadmin aksiyonu |
|---|---|---|
| **owner_missing** (C1) | Ödeme YİNE uygulanır (plan + fatura); audit yazarı = herhangi bir tenant kullanıcısı, yoksa atlanır | Tenant'a BAYI_SAHIBI rolü ata |
| **amount_mismatch** (I3) | Plan AÇILMAZ (manipülasyon koruması); audit + alert | Para PayTR'da çekildiyse **PayTR panelinden manuel iade** |
| **Nilvera fatura fail** (C2) | invoice `pending` kalır; `invoice-reconcile` cron N kez dener, sonra alert | VKN/Nilvera ayarını düzelt; gerekirse manuel "Faturayı yeniden çek" |
| **dunning** (yenileme fail) | `past_due` + retry (1/3/5g) + kullanıcıya "kartını güncelle" e-postası + alert; retry tükenince FREE + downgrade e-postası | Genelde otomatik; kalıcı sorunlu tenant'a ulaş |
| **skippedInFlight** (C4) | Çözülmemiş `pendingMerchantOid` olan abonelik tekrar ÇEKİLMEZ (çift tahsilat koruması) | Uzun süre takılırsa PayTR panelinden ödeme durumunu kontrol et |

### 9.2 Manuel iade / chargeback prosedürü (H3)
PetStockPro'da **otomatik iade akışı YOK** (MVP — para akışı PayTR'da). İade gereken durumlar:
1. **amount_mismatch** sonrası yanlış tahsilat, veya **çift çekim** (lost wait_callback + manuel zorlama).
2. Müşteri itirazı / chargeback.

**Adımlar:** (a) PayTR Mağaza Panel → İşlemler → ilgili `merchant_oid`'i bul → **İade Et**. (b) İlgili `invoices` satırını süperadmin DB Inspector'dan kontrol et/not düş. (c) Gerekirse Nilvera'dan faturayı **iptal et** (`cancelNilveraInvoice`, 3 gün içinde — `src/lib/nilvera/invoice.ts`). Chargeback'te PayTR e-posta ile bilgilendirir; itiraz belgesi PayTR panelinden yüklenir.

### 9.3 Plan değişimi — upgrade ANINDA (tam fark), downgrade dönem-sonu (H2)

**Kullanıcı kararı (2026-07-02) — H2 revize:** eski "her iki yönde de dönem-sonu, proration yok" kararı SADECE downgrade'de kaldı. Upgrade (PRO→PRO+) artık dönem sonunu beklemez.

**Kullanıcı kararı (2026-07-03) — proration KALDIRILDI:** upgrade'de geçen gün DÜŞÜLMEZ; her zaman **TAM fark** (`targetAmount − currentAmount`, ör. PRO+ 2.000 − PRO 1.000 = 1.000₺) tahsil edilir. Ondalıklı "orantılı" tutar (9,95 gibi) kafa karıştırıcı bulundu. Sonraki yenilemede zaten tam PRO+ fiyatı çekilir. `computeProration` (totals.ts) artık KULLANILMIYOR (tested util olarak duruyor — proration'a dönülürse hazır).

- **Upgrade (PRO→PRO+) — saklı kart VARSA:** `upgradeSubscriptionNow` (`src/lib/billing/upgrade-now.ts`). Tam fark saklı karttan ANINDA çekilir (PayTR `chargeSavedCard`, non3d). Başarılıysa `subscriptions.plan`+`companies.plan` hemen güncellenir — **dönem tarihleri DEĞİŞMEZ** (`currentPeriodStart`/`End` aynı kalır), `amountTry` yeni planın TAM fiyatına güncellenir (sonraki yenileme aynı günde). Fark için ayrı `invoices` satırı (periodStart=now, periodEnd=eski currentPeriodEnd) + Nilvera'ya ayrı fatura ("...yükseltme (dönem içi fark)"). Çekim başarısız/wait_callback → HİÇBİR ŞEY değişmez (fail-safe). Ortak apply mantığı `applyUpgradeInTx` (saklı-kart + iframe yolları paylaşır).
- **Upgrade (PRO→PRO+) — saklı kart YOKSA (2026-07-03):** `startUpgradeCheckout` (upgrade-now.ts) → kullanıcı kartını **PayTR iframe**'inde girer, tam fark iframe'de tahsil edilir. `subscriptions.pending_upgrade_oid` + `pending_upgrade_amount_try` set edilir (migration 0041). Ödeme callback'i — `orchestrator.processInTransaction` içinde idempotency'den SONRA gelen **izole** `applyUpgradePayment` dalı (`pending_upgrade_oid` ile eşleşir; `pending_merchant_oid` yenileme/checkout yolundan AYRI, o yolu HİÇ etkilemez) — tutarı doğrular + planı uygular (dönem KORUNUR) + kartı saklar. Başarısız/uyuşmazsa plan PRO kalır, pending temizlenir (dunning YOK). UI: `previewUpgradeNowAction` (tutar önizle) → **`swalConfirm`** (native `window.confirm` DEĞİL) → `upgradeNowAction`; `no_saved_card` dönerse `startUpgradeCheckoutAction` → `PaytrIframeModal` (BillingCheckout ile paylaşımlı bileşen).
- **Downgrade (PRO+→PRO):** `subscriptions.pending_plan` (`schedulePlanChange`, manage.ts) — eski davranış aynen korunur. Anlık tahsilat/iade YOK; değişim **bir sonraki yenilemede** geçerli. Renewal çekimden ÖNCE yeni plan fiyatını uygular (`effectivePlanAndAmount`) → callback'te `plan`+`amountTry` güncellenir, `pendingPlan` temizlenir. UI: "Plan değiştir (dönem sonunda)" + "📅 X tarihinde geçecek (iptal et)".

### 9.4 Downgrade vitrin mutabakatı (I2)
Abonelik expire → FREE olunca FREE vitrin limitini (10) aşan ürünler otomatik vitrin'den çekilir (`vitrinAutoUnpublishedReason='plan_downgrade'`, en eskiler). Ürünler **silinmez**; PRO'ya dönünce tekrar yayınlanabilir.

### 9.5 Eşzamanlılık (H1)
`runBillingRenewals` "claim" transaction: due abonelikler `FOR UPDATE OF subscriptions SKIP LOCKED` ile seçilip `pendingMerchantOid` atanır → eşzamanlı cron çalışması aynı aboneliği iki kez çekemez.

---

## 10. Canlı fatura — VKN doğrulama + fatura tipi yönlendirme (2026-06-19)

Kullanıcı canlı `NILVERA_API_KEY` aldı. Önceki durum: HER fatura e-Arşiv kesiliyordu, müşteri VKN'si Nilvera'da doğrulanmıyordu, alıcı adresi `'—'` placeholder'dı. Kullanıcı kararları + yapılanlar:

### 10.1 Kararlar
- **Tam yönlendirme:** müşteri VKN'sine göre e-Fatura / e-Arşiv seçilir.
- **VKN zorunlu değil:** 10 hane → kurumsal; vergi no boşsa **nihai tüketici** (ad+adres yeterli, TCKN istenmez).

### 10.2 Yönlendirme (`resolveAndIssueInvoice` — `lib/nilvera/invoice.ts`)
| Girdi | Sorgu | Sonuç |
|---|---|---|
| 10 hane VKN | `checkTaxpayer` → `GET /general/GlobalCompany/Check/TaxNumber/{vkn}?globalUserType=Invoice` | dizi dolu → **e-Fatura** (`POST /einvoice/Send/Model`, `{EInvoice, CustomerAlias}`); boş/404 → **e-Arşiv** |
| 11 hane TCKN | (sorgu yok) | **e-Arşiv** |
| boş | (sorgu yok) | **nihai tüketici e-Arşiv**, `TaxNumber=11111111111` |
| geçersiz | — | throw → fatura `pending`, reconcile yeniden dener |

e-Fatura etiketi (alias) = check yanıtındaki `Name`; ünvan = `Title`.

### 10.3 Gerçek adres
`lib/billing/invoice-customer.ts` (`loadInvoiceCustomer`/`buildInvoiceCustomer`): company `cityId`/`districtId` → il/ilçe **adına** join + `companies.billing_address`. Orchestrator + reconcile bunu kullanır.

### 10.4 Migration 0038 (manuel, Supabase + Aiven)
`companies` += `vat_no_status` / `vat_no_title` / `vat_no_verified_at` / `billing_address`; `invoices` += `invoice_kind` ('efatura' | 'earsiv').

### 10.5 UI
- `/admin/settings/company`: VKN **"Doğrula"** butonu (canlı `checkTaxpayer` → ünvan/mod gösterir, `verifyAndSaveVatNo`) + fatura adresi. VKN değişince doğrulama durumu sıfırlanır.
- Süperadmin `system-settings`: **"Nilvera Bağlantı Testi"** (`GET /general/Company` → satıcı hesabını + serie durumunu gösterir; anahtarı paylaşmadan canlı kurulum doğrulama).

### 10.6 Kullanıcı aksiyonları (canlı fatura için şart)
- **Nilvera portal:** e-Arşiv serisi tanımla → kodu `NILVERA_SERIE` env'e (yoksa fatura kesilemez). Firma Bilgileri eksiksiz (satıcı tarafı otomatik buradan gelir).
- **Vercel env:** `NILVERA_BASE_URL=https://api.nilvera.com` (apitest değil), `NILVERA_SELLER_VKN` + `NILVERA_SELLER_TITLE`, `NILVERA_SERIE`.
- Doğrulama: süperadmin → Sistem Ayarları → "Nilvera Bağlantı Testi".
