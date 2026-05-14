# PetStockPro — Ödeme Entegrasyonu + Uyum

**Tarih:** 2026-05-14
**Kapsam:** iyzico Subscription (TR) + Nilvera e-Arşiv (TR)
**Durum:** Sprint 13 (iyzico) + Sprint 14 (Nilvera) için referans
**Otoritatif:** Bu doküman implementation + uyum + sözleşme + lansman checklist'i bir arada tutar

> **🇹🇷 TR-only Kararı (2026-05-14):** Bu sürüm **yalnızca Türkiye** kapsamı içindir. Paddle MoR yurt dışı abonelik entegrasyonu, KVKK Madde 9 yurt dışı veri aktarım açık rıza akışı, GDPR cookie banner ve sub-processor olarak Paddle bu sürümden **kaldırıldı**. Yurt dışı pet shop talebi gelirse Faz 2'de yeniden değerlendirilecek (bkz. §10 Karar Geçmişi).

> **Felsefe (PARA AKIŞI ÇİZGİSİ — DEĞİŞMEZ):** PetStockPro **alıcı (müşteri) ile satıcı (pet shop) arasındaki para akışına ASLA dahil değildir.** Bu dokümanda sadece **B2B abonelik** (pet shop → PetStockPro PRO / PRO+ planı) ve **e-Arşiv fatura** (pet shop'un kendi vergi yükümlülüğü için) entegrasyonu var. Detay: `EKRAN-PUBLIC-VITRIN.md §13.4`.

> **Plan kademeleri otoritatif belge:** `PLAN-KADEMELERI.md` (3-tier B — FREE 50 / PRO 500 / PRO+ Sınırsız). Bu doküman fiyat detayını yeniden tanımlamaz, sadece referans verir.

---

## 1. Ödeme Modeli — Tek Yön: B2B Abonelik (TR-only)

```
Pet Shop (TR tenant)
    │
    │  Aylık 750 ₺ (PRO) veya 1.750 ₺ (PRO+) — KDV dahil
    ▼
┌────────────────┐
│  iyzico (TR)   │
│  Subscription  │
└────────┬───────┘
         │
         │  Para akışı (TL)
         ▼
    PetStockPro IBAN (Türkiye, TL hesap)
```

- **TR-only:** Kayıt formunda ülke dropdown'u yok; tüm tenant Türkiye varsayılır. Vergi adresi TR il/ilçe seçimi ile alınır.
- **B2C (müşteri ↔ pet shop) PetStockPro'dan geçmez.** Müşteri pet shop'a WhatsApp deep link ile ulaşır, ödeme kapıda / havale / kart pet shop'un kendi sistemi ile yapılır.

---

## 2. iyzico Subscription (TR)

### 2.1 Mimari

**iyzico Subscription API** (recurring billing) + 3D Secure mandatory + webhook ile durum güncelleme.

```
1. Pet shop Settings > Plan > "PRO'ya Yükselt" veya "PRO+'ya Yükselt" tıklar
2. Frontend → /api/billing/iyzico/checkout → checkout token
3. iyzico hosted checkout açılır (kart bilgisi bizim sunucudan geçmez — PCI DSS dışı kalırız)
4. 3D Secure doğrulama
5. Başarılı → iyzico webhook → /api/webhook/iyzico
6. Backend: companies.plan = 'PRO' veya 'PRO_PLUS', subscriptions tablosuna kayıt
7. Tenant'a Telegram + e-posta bildirim
8. Aylık otomatik tahsilat (iyzico tarafı)
```

### 2.2 Yasal/Uyum

- **iyzico:** BDDK lisanslı ödeme kuruluşu (Türkiye) — bizim ek lisans gereksinimimiz YOK
- **Bayi sözleşmesi:** PetStockPro ↔ iyzico arası (online imza, ~1 hafta onboarding)
- **3D Secure mandatory:** Kart bilgisi bize hiç gelmez (PCI DSS scope'tan çıkarız)
- **KKDF/BSMV:** iyzico otomatik keser ve bildirir (banka muamele vergisi)
- **Komisyon:** iyzico tarifesi (~%2.5-3.5 + 0.25₺/işlem)
- **KVKK:** Veriler iyzico Türkiye sunucularında — yurt dışına çıkmaz, **KVKK Madde 9 yurt dışı aktarım gerekmez**, sadece KVKK iç aktarım (TR sub-processor) aydınlatması yeterli

### 2.3 Webhook Güvenlik

```ts
// app/api/webhook/iyzico/route.ts
import { verifyIyzicoSignature } from '@/lib/iyzico';

export async function POST(req: Request) {
  const signature = req.headers.get('x-iyz-signature');
  const body = await req.text();

  if (!verifyIyzicoSignature(body, signature, process.env.IYZICO_SECRET_KEY!)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);
  // event.eventType: 'subscription.activated', 'subscription.cancelled',
  //                  'subscription.payment_failed', 'subscription.renewed'
  await handleIyzicoEvent(event);
  return Response.json({ ok: true });
}
```

### 2.4 Hata/İade Yönetimi

| Durum | Aksiyon |
|---|---|
| Ödeme başarısız | 3 deneme (24h interval) → tenant'a uyarı → 7 gün sonra plan FREE'ye düşer |
| İade talebi | Süperadmin manuel onay (Vitrin Modlama dışı, Plan İptal sekmesi) → iyzico API ile iade |
| Kart süresi doldu | Tenant'a otomatik hatırlatma (3 gün önce + 1 gün önce) → Settings'ten yeni kart |
| Şüpheli işlem | iyzico fraud detection → manuel onay → çoğu otomatik geçer |

### 2.5 Test/Sandbox

- iyzico Sandbox API: `https://sandbox-api.iyzipay.com`
- Test kartlar: `5528790000000008` (success), `4111111111111129` (fail), vs
- Sprint 13 boyunca sandbox + Sprint 16 lansman öncesi production geçiş

### 2.6 Sözleşmeler

- **iyzico Bayi Sözleşmesi:** PetStockPro ↔ iyzico (online imza)
- **Tenant'la sözleşme:** Settings > Plan > "PRO'ya / PRO+'ya Yükselt" akışında **Aydınlatma + Sözleşme onay** modal'ı:
  - Hizmet sözleşmesi (PetStockPro PRO veya PRO+ planı)
  - Aydınlatma metni (KVKK — TR iç aktarım)
  - Cayma hakkı (14 gün — abonelik için)
  - Otomatik yenileme onayı

---

## 3. Nilvera E-Arşiv Fatura (TR)

### 3.1 Mimari

**Nilvera REST API** ile pet shop'un kendi e-Arşiv faturalarını otomatik kesme.

```
1. Pet shop Stok Çıkışı drawer'ında "E-Arşiv fatura kes" toggle
2. Satış kaydedildiğinde → backend Nilvera API çağrı:
   POST /api/v1/invoices
   {
     vkn_or_tckn: '1234567890',
     buyer: { name, vkn, address },
     items: [{ name, qty, unit_price, vat_rate }],
     total: ...
   }
3. Nilvera GİB'e gönderir (e-Arşiv portalı)
4. Webhook → /api/webhook/nilvera → fatura UUID + PDF URL
5. Backend: invoices tablosuna kayıt + tenant'a Telegram bildirim
6. Müşteriye e-posta (PDF link)
```

### 3.2 Tenant Şartları (önemli — onboarding'de açıkça anlat)

Pet shop e-Arşiv fatura kesmek için:

1. **Vergi mükellefi olmak** — şirket veya şahıs şirketi (mahalle pet shop için bile)
2. **Mali mühür sertifikası** — TÜBİTAK Kamu SM (~750₺/yıl)
3. **GİB e-Arşiv başvurusu** — gib.gov.tr üzerinden başvuru (1-2 hafta onay)
4. **Nilvera abonelik** — Nilvera kontör paketi satın alma (pet shop tarafı, biz ücret almıyoruz, Nilvera ile direkt)

**Bu şartları sağlamayan tenant** "E-Arşiv fatura kes" toggle'ı açamaz — Settings > Plan + Fatura'da net açıklama + checklist.

### 3.3 Yasal/Uyum

- **Nilvera:** GİB onaylı e-Arşiv entegratör — yasal güvence Nilvera tarafında
- **PetStockPro pozisyonu:** Sadece **proxy/teknik aracı** — fatura içeriği tenant'ın sorumluluğunda
- **Veri saklama:** Faturalar GİB sistemine gider, biz 5 yıl PDF URL referansı tutarız (yasal süre)
- **Hatalı fatura iptali:** Nilvera API ile e-Arşiv iptal + GİB'e iletilir

### 3.4 Webhook Güvenlik

```ts
// app/api/webhook/nilvera/route.ts
const signature = req.headers.get('x-nilvera-signature');
const body = await req.text();

if (!verifyHmacSha256(body, signature, process.env.NILVERA_WEBHOOK_SECRET!)) {
  return new Response('Invalid signature', { status: 401 });
}

const event = JSON.parse(body);
// event.type: 'invoice.created', 'invoice.cancelled', 'invoice.failed'
```

### 3.5 Hata Yönetimi

| Hata | Aksiyon |
|---|---|
| Mali mühür süresi dolmuş | Tenant'a uyarı: "Mali mühür yenilenmesi gerekli, TÜBİTAK SM" |
| GİB sistemi cevap vermiyor | Retry queue (5 dakika, 1 saat, 6 saat) → başarısızsa tenant'a manuel uyarı |
| Hatalı VKN | Frontend validation (10/11 hane checksum) — backend ek kontrol |
| Kontör bitmiş (Nilvera) | Tenant'a uyarı: "Nilvera kontör paketinizi yenileyin" |

### 3.6 MVP Kapsamı

- ✅ E-Arşiv fatura otomatik kesme (Stok Çıkışı sonrası)
- ✅ PDF download (admin + müşteriye e-posta)
- ✅ Fatura listesi (Settings > Plan + Fatura > Faturalarım)
- ❌ E-Fatura (B2B, sadece e-Arşiv B2C — MVP)
- ❌ İrsaliye (Faz 3)
- ❌ Toplu fatura (Faz 3)

---

## 4. Yurt Dışı Abonelik — Faz 2 (Şu An Aktif Değil)

> **Durum (2026-05-14):** Yurt dışı pet shop abonelik akışı (Paddle MoR) **proje kapsamı dışı**. Aşağıdaki notlar Faz 2'de talep gelirse referans olarak tutulur, **uygulamaya alınmadı**.

**Neden ertelendi:**
- TR-only odak: lansman süresini kısaltmak ve regülasyon yüzeyini daraltmak
- KVKK Madde 9 yurt dışı veri aktarım akışı + GDPR cookie banner + EN locale + döviz kuru entegrasyonu (Frankfurter API) bir bütün olarak Faz 2'ye bırakıldı
- Pazar önceliği: Türkiye 10-15K pet shop hedefi (PLAN-KADEMELERI §3)

**Faz 2'de talep gelirse ele alınacak başlıklar (özet):**
- Paddle MoR (Merchant of Record) vendor onboarding + DPA
- KVKK Madde 9 açık rıza modal'ı (yurt dışı veri aktarımı)
- GDPR cookie banner (opt-in)
- EN locale (next-intl)
- Aydınlatma metnine Paddle sub-processor eklenmesi
- Webhook + Subscription lifecycle Paddle event'ları için genişletme

**Mevcut sürümde uygulanmadı.** Lansman checklist'i (§7) ve sub-processor listesi (§8.2) Paddle satırı içermez.

---

## 5. Cross-Cutting Konular

### 5.1 PII (Personally Identifiable Information) Handling

**PetStockPro'nun tuttuğu PII:**
- Tenant: e-posta, ad/soyad, vergi no, adres, telefon
- Müşteri (vitrin ziyaretçi): IP **hash** (raw IP YOK — anonim agg)
- Pet shop sahibinin Telegram chat_id

**PII tutmadığımız:**
- Kart bilgisi (iyzico hosted)
- Müşteri kimlik bilgisi (vitrin'de hesap yok)
- Banka hesap bilgisi (IBAN sadece tedarikçi/şube formunda — opsiyonel)

### 5.2 Audit Log Requirements (Ödeme İçin)

Her ödeme aksiyonu `audit_logs` tablosuna yazılır:
```
plan.upgrade_started     — checkout başladı
plan.upgrade_completed   — ödeme başarılı
plan.upgrade_failed      — ödeme reddedildi
plan.cancelled           — abonelik iptal
plan.refunded            — iade
invoice.created          — e-Arşiv fatura kesildi (Nilvera)
invoice.cancelled        — fatura iptal
```

> Not: `plan.paddle_consent` (yurt dışı veri aktarım açık rıza) audit aksiyonu TR-only sürümde **kullanılmıyor**. Faz 2'de yeniden eklenir.

### 5.3 Webhook Idempotency

Webhook'lar **birden fazla kez gönderilebilir** (network retry). Backend her event ID'yi kayıt eder, tekrar gelirse skip eder.

```ts
// processed_webhooks tablosu
const existing = await db.select().from(processedWebhooks)
  .where(eq(processedWebhooks.eventId, event.id));

if (existing.length > 0) {
  return Response.json({ ok: true, duplicate: true });
}

await db.transaction(async (tx) => {
  await processEvent(event, tx);
  await tx.insert(processedWebhooks).values({ eventId: event.id, processedAt: new Date() });
});
```

### 5.4 Subscription Lifecycle State Machine

```
[no_subscription] (FREE)
       │
       │ upgrade started (PRO veya PRO+)
       ▼
[checkout_pending]
       │
       │ payment success           payment fail
       ├────────────────►       ◄──────────────
       ▼                                       │
[active]                                       ▼
       │                              [checkout_failed]
       │ next billing
       ▼
[active] (renewed)
       │
       │ payment fail (1st try)
       ▼
[past_due] ─── retry 24h, 48h, 72h ───┐
       │                                │
       │ all fails                      │ payment success
       ▼                                ▼
[suspended] ──── 7 gün ────► [cancelled] (FREE)
```

Plan downgrade kuralları (PRO+ → PRO veya PRO → FREE) için bkz. `PLAN-KADEMELERI.md §5`.

---

## 6. .env Yapılandırma

```bash
# iyzico (TR)
IYZICO_API_KEY=
IYZICO_SECRET_KEY=
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com   # prod: https://api.iyzipay.com
IYZICO_WEBHOOK_SECRET=

# Nilvera (TR e-Arşiv)
NILVERA_API_KEY=
NILVERA_BASE_URL=https://api.nilvera.com
NILVERA_WEBHOOK_SECRET=

# Paddle (yurt dışı) — Faz 2, şu an kullanılmıyor. Bkz. §4.
# PADDLE_VENDOR_ID=
# PADDLE_API_KEY=
# PADDLE_PUBLIC_KEY=
# PADDLE_WEBHOOK_SECRET=
# PADDLE_BASE_URL=
# NEXT_PUBLIC_PADDLE_VENDOR_ID=
# NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
```

---

## 7. Lansman Öncesi Checklist (Sprint 16, TR-only)

### 7.1 iyzico
- [ ] iyzico Bayi Sözleşmesi imzalandı (production hesap)
- [ ] Production API key + Secret + Webhook URL kayıt
- [ ] Webhook signature doğrulama test (production)
- [ ] 3D Secure flow test (gerçek kart, küçük tutar)
- [ ] Vergi numarası + IBAN PetStockPro adına kayıtlı
- [ ] KKDF/BSMV otomatik kesinti doğrulandı
- [ ] PRO (750 ₺/ay KDV dahil) ve PRO+ (1.750 ₺/ay KDV dahil) abonelik ürünleri iyzico paneline tanımlı

### 7.2 Nilvera
- [ ] Nilvera kurumsal hesap aktif
- [ ] PetStockPro mali mühür sertifikası (TÜBİTAK SM)
- [ ] PetStockPro GİB e-Arşiv başvurusu onaylı
- [ ] Production API key + Webhook URL
- [ ] Test fatura GİB sistemine başarıyla iletildi
- [ ] Tenant onboarding akışı: e-Arşiv şartları açıklayan modal hazır

### 7.3 Yasal Genel (TR-only)
- [ ] KVKK Aydınlatma metni güncel (iyzico + Nilvera + Supabase + Cloudflare + Brevo + Sentry + Telegram sub-processor listesi — **hepsi TR iç aktarım veya KVKK Madde 9 yeterli koruma listesinde**)
- [ ] Tenant onboarding'de hizmet sözleşmesi + cayma hakkı (14 gün) + KVKK onay
- [ ] Veri sahibi hakları (silme, erişim, düzeltme) talepleri için `privacy@petstockpro.com` aktif
- [ ] ETBİS bildirimi (yer/içerik sağlayıcı pozisyonu)
- [ ] Mesafeli satış sözleşmesi YOK çünkü biz satıcı değiliz (ama disclaimer vitrin altında)
- [ ] Kayıt formunda ülke seçimi YOK — TR varsayılan

### 7.4 Süperadmin Plan Onay
- [ ] MVP'de manuel havale alımı (iyzico öncesi) → Süperadmin Plan Onay sekmesi çalışıyor
- [ ] Faz 2'de iyzico aktive olunca manuel havale **deprecate** (gerekirse fallback)

---

## 8. Sözleşme Şablonları (Tenant'a Sunulacak)

### 8.1 PetStockPro Hizmet Sözleşmesi
- Hizmet kapsamı (stok takip + vitrin)
- Ücret (FREE / PRO 750 ₺ KDV dahil / PRO+ 1.750 ₺ KDV dahil — detay: `PLAN-KADEMELERI.md`)
- Cayma hakkı (14 gün)
- Otomatik yenileme
- Veri sahipliği (tenant'ın verisi)
- Hizmet kesintisi (SLA — best effort)

### 8.2 KVKK Aydınlatma Metni
- Veri sorumlusu: PetStockPro (şirket adı)
- Toplanan veriler kategorisi
- İşleme amacı
- **Sub-processor listesi (TR-only):** iyzico (TR), Nilvera (TR), Supabase, Cloudflare, Brevo, Sentry, Telegram. Tümü ya Türkiye'de ya da KVKK Madde 9 yeterli koruma listesindeki ülkelerde — yurt dışı veri aktarımı için ek açık rıza akışı **gerekmez**.
- Veri sahibi hakları
- İletişim: privacy@petstockpro.com

### 8.3 Cookie Politikası
- Çerez kategorileri (zorunlu / analytics)
- Üçüncü taraf çerezler (Sentry, Cloudflare Analytics)
- Kullanıcı tercihi yönetimi
- GDPR opt-in cookie banner Faz 2 (yurt dışı tenant ile birlikte)

### 8.4 Vitrin Müşteri Aydınlatması (B2C)
- Vitrin ziyaretçileri için (anonim ama vitrin_events tracking)
- IP hash + UA toplandığı bildirimi
- ETBİS yer sağlayıcı pozisyonu

---

## 9. Sprint Planı Etkisi

### Sprint 13 — iyzico Subscription (1.5 hafta)
1. iyzico SDK kurulum + sandbox config (1 gün)
2. Subscription API entegrasyon — PRO + PRO+ ürünleri (3 gün)
3. Settings > Plan > "PRO'ya / PRO+'ya Yükselt" UI + 3D Secure (2 gün)
4. Webhook handler + idempotency (1 gün)
5. Subscription lifecycle state machine (1 gün)
6. KVKK iç aktarım onay akışı + audit log (1 gün)
7. Hizmet sözleşmesi modal (KVKK + cayma hakkı) (0.5 gün)
8. Sandbox testleri (0.5 gün)

### Sprint 14 — Nilvera e-Arşiv (1 hafta)
1. **Nilvera (3 gün):**
   - API entegrasyon (e-Arşiv kesme)
   - Webhook handler
   - Stok Çıkışı drawer'a "E-Arşiv kes" toggle
   - Tenant onboarding'de e-Arşiv şartları açıklama (mali mühür + GİB başvuru)
   - Hata yönetimi (kontör bitti, sertifika süresi)
2. Sandbox testleri (1 gün)
3. Production geçiş hazırlığı (1 gün)

> Önceki taslakta Sprint 14 = "Paddle + Nilvera" idi. 2026-05-14 TR-only kararı ile **Paddle çıkarıldı**, Sprint 14 yalnızca Nilvera kapsamına indi (~0.5 hafta kazanç). Bkz. §10.

---

## 10. Karar Geçmişi

| Tarih | Karar | Etki |
|---|---|---|
| 2026-05-12 | İlk taslak: 3-tier (FREE / PRO / PRO+) + iyzico + Nilvera + Paddle MoR + KVKK Madde 9 yurt dışı aktarım açık rıza + GDPR + EN locale + Frankfurter kur | Lansman kapsamı geniş |
| 2026-05-13 | PRO+ rafa kaldırıldı → 2-tier (FREE 50 / PRO sınırsız) | Stratejik sadeleştirme (sonradan iptal) |
| 2026-05-14 | **(1)** 3-tier B geri açıldı: FREE 50 / PRO 500 (750 ₺/ay KDV dahil) / PRO+ Sınırsız (1.750 ₺/ay KDV dahil). Otoritatif: `PLAN-KADEMELERI.md`. **(2)** TR-only kararı: Paddle MoR + KVKK Madde 9 yurt dışı aktarım akışı + GDPR cookie banner + EN locale + Frankfurter kur entegrasyonu **kapsam dışı**. Faz 2'de yurt dışı talep gelirse yeniden değerlendirilir. | Bu sürümün otoritatif kararları |

---

## 11. Riskler

| Risk | İhtimal | Etki | Önlem |
|---|---|---|---|
| iyzico bayi sözleşmesi onay gecikmesi | Orta | 1 hafta | Sprint 13 başında başvuru |
| Nilvera kontör bitmesi tenant'da | Yüksek | Tenant fatura kesemiyor | Otomatik uyarı + Settings'te kontör görünür |
| KVKK denetimi (TR iç aktarım) | Düşük | Para cezası 50K-1M₺ | Aydınlatma metni eksiksiz + sub-processor listesi güncel |
| Webhook event sırası karışık | Yüksek | Subscription state yanlış | Idempotency + state machine + audit log |
| Tenant kart bilgisi sızması | Çok düşük | Hukuki + itibar | Hosted checkout (kart bilgisi bize hiç gelmez) |
| Yurt dışı tenant talebi MVP'de gelir | Düşük | Müşteri kaybı | Faz 2 roadmap'inde Paddle yeniden açılır (§4) |

---

## 12. İlgili Dokümanlar

- `PLAN-KADEMELERI.md` — **3-tier B otoritatif belge** (FREE 50 / PRO 500 / PRO+ Sınırsız + KDV dahil fiyatlar)
- `EKRAN-AYARLAR.md §2.2` — Plan + Fatura UI
- `EKRAN-PUBLIC-VITRIN.md §13.4` — Para akışı çizgisi (B2C YOK)
- `DATABASE-SCHEMA.md` — `subscriptions`, `invoices`, `processed_webhooks` tabloları (Faz 2)
- `EKRAN-SUPERADMIN.md §2.4` — Plan Onay manuel havale (MVP fallback)
- `SUPABASE-SETUP.md` — Webhook endpoint security headers
- `SPRINT-PLAN.md §16-17` — Sprint 13 + 14 detayları

---

*Son güncelleme: 2026-05-14. TR-only sürüm — iyzico + Nilvera entegrasyon + uyum şartları + lansman checklist. Paddle ve yurt dışı bileşenler §4 altında Faz 2 olarak pasifize edildi.*
