# PetStockPro — Plan Kademeleri

**Tarih:** 2026-05-12 (revize 2026-05-13 → tekrar revize **2026-05-14 — 3-tier'a geri açıldı, TR-only**)
**Durum:** Otoritatif karar
**Felsefe:** *"Tüm özellikler tüm planlarda açık. Sadece stok limiti farklı."*

> **🚨 2026-05-14 KARAR REVİZYONU — 3-tier geri açıldı, TR-only:**
> *"FREE, PRO, PRO+ — sadece stok sayısına insanların artırmalarını istiyorum. Şimdilik sadece TR'de kullanılacak."* — kullanıcı.
>
> **Yeni 3-tier:** FREE **50** / PRO **500** (1.000 ₺) / PRO+ **Sınırsız** (2.000 ₺). _2026-05-21 revize — pricing 1.250/2.250'den 1.000/2.000'e düşürüldü (kullanıcı kararı: fiyat artırma)._
> Farklılaşma **tek boyutta** — ürün limiti. Diğer tüm özellikler (vitrin, çoklu şube, audit, 2FA, asistan, raporlar, KVKK, Telegram, e-Arşiv vb.) **tüm planlarda açık**.
>
> **Önceki kararlar:**
> - 2026-05-13: "PRO+ rafa kaldırıldı, 2-tier" → **İPTAL**
> - 2026-05-12: "20/100/∞ 3-tier" → İPTAL (limitler değişti)
>
> **TR-only:** Yurt dışı (Paddle MoR + EN locale + Frankfurter kur) **proje kapsamı dışı**. Faz 2'de talep gelirse açılır. Sadece iyzico (TR) + Nilvera (TR e-Arşiv).

---

## 1. Plan Tablosu (3-tier B — Dengeli, 2026-05-22 revize)

| Plan | Stok | Vitrin | Şube | Excel import | Gelişmiş rapor | Aylık fiyat |
|---|---:|---:|---:|:---:|:---:|---:|
| **FREE** | **50** | **10** | **1** | ❌ | ❌ | 0 ₺ |
| **PRO** | **500** | **500** | **∞** | ✅ | ✅ | 1.000 ₺ |
| **PRO+** | **∞** | **∞** | **∞** | ✅ | ✅ | 2.000 ₺ |

**Fiyat KDV dahil** (2026 oranı %20):
- PRO matrah = 833,33 ₺ + KDV 166,67 ₺
- PRO+ matrah = 1.666,67 ₺ + KDV 333,33 ₺

> **2026-05-22 Karar A revize:** Tek farklılaşma "stok limiti" yetersiz görüldü → 4 yeni farklılaşma eklendi (vitrin limit + şube limit + Excel import + gelişmiş raporlar). Eşit rekabet felsefesi KORUNDU — sponsorship/sıralama bonusu YOK, vitrin metrikleri/audit/2FA/asistan/Telegram/Nilvera e-Arşiv tüm planlarda EŞİT. Diğer farklılaşma kategorileri: ya **sayısal limit** (10/500) ya da **doğal sınır** (manuel→Excel, tek→çoklu, basit→detaylı).

### Yurt dışı tier önerisi (Faz 2 — TR-only kararı korunur)

> **2026-05-22 USD pricing kararı:** Yurt dışı tier'ı **şu an açılmıyor** — TR-only kararı (2026-05-14) lansman için korunur. Aşağıdaki USD pricing Faz 2'de (Paddle MoR + EN locale + KVKK Madde 9 yurt dışı veri aktarım çift checkbox) açıldığında kullanılacak öneri değerlerdir. `src/lib/constants/plan-limits.ts` ve `plans` master tablosu seed'inde `priceMonthlyUsd` alanı doldurulmuştur.

| Plan | TR aylık (KDV dahil) | Yurt dışı aylık (Faz 2) |
|---|---:|---:|
| FREE | 0 ₺ | $0 |
| PRO | 1.000 ₺ | **$20** |
| PRO+ | 2.000 ₺ | **$50** |

Faz 2'de aktive edilecekler:
- Paddle MoR entegrasyonu (yurt dışı kart tahsilatı + VAT/sales tax otomatik)
- EN locale UI (next-intl yapısı hazır, gizli mod açılır)
- KVKK Madde 9 yurt dışı veri aktarım açık rıza akışı (kayıt formunda 3. checkbox)
- Frankfurter kur API (TRY ↔ USD anlık kur)
- Vitrin'de USD currency disclaimer

**Lansman senaryosu:** Sprint 13/14 (Sprint 14 = production deploy) TR-only olarak çıkar. Yurt dışı tier 6-12 ay sonra (sprint sonrası gerçek conversion verisi + tek geliştirici operasyonel kapasite değerlendirmesi sonrası).

### Segment Mantığı

| Tier | Pet shop büyüklüğü | Pazardaki yaklaşık pay |
|---|---|---:|
| FREE | Çok küçük (20-50 ürün) | %50-60 (ama düşük conversion) |
| PRO | Mahalle olgun + küçük zincir (100-500 ürün) | %30-35 |
| PRO+ | Çoklu şube + yüksek katalog (500+ ürün) | %5-10 |

### Karar Geçmişi

| Tarih | Karar | Durum |
|---|---|---|
| Faz 1 §7 (eski Pet/) | 50/200/∞ 3-tier | Legacy |
| 2026-05-12 | 20/100/∞ 3-tier | İptal — limitler değişti |
| 2026-05-13 | 50/∞ 2-tier (PRO+ rafa) | İptal — kullanıcı geri açtı |
| 2026-05-14 | 50/500/∞ 3-tier B (TR-only), tek farklılaşma stok | İptal — farklılaşma yetersiz |
| 2026-05-20 Karar A | "(a) sade tut, tek stok limiti" | İptal — 2026-05-22'de revize |
| 2026-05-22 Karar A revize | 50/500/∞ 3-tier B + 4 ek farklılaşma (vitrin 10/500/∞ + şube 1/∞/∞ + Excel + raporlar) | Aktif |
| **2026-05-22 USD pricing** | **Yurt dışı tier Faz 2 önerisi: PRO $20 / PRO+ $50** (TR-only kararı korunur) | **Aktif** |

### Neden 3-tier B?

- **Doğal segment ayrımı** — Mahalle 50'de fit, olgun mahalle PRO'ya geçer, büyük chain PRO+ alır
- **Tek farklılaşma stok sayısı** — Pazarlama mesajı net: *"Büyüdükçe öde"*
- **PRO+ pricing premium** — Büyük chain (500+ ürün) için 2.000 ₺ orta-piyasa POS yıllık ücretinin altı (rakip Logo Go ~2-3K ₺/ay)
- **Yeşil alan avantajı** — TR'de pet shop'a özel SaaS yok (TESK 2024 + DEPLOYMENT.md §6.5)

---

## 2. Ürün Sayımı (Plan Limiti Hesabı)

- **Parent ürün = 1 sayılır** (örn. "Royal Canin Adult Kedi Maması" 1 ürün)
- **Variant'lar bedava** (sınırsız boyut/ambalaj — 400g, 2kg, 10kg ücretsiz)
- **Arşivlenmiş ürün** plan limit'e **dahil değil** (soft delete)

**Örnek:**
```
Royal Canin Adult Kedi Maması  (parent — 1 sayım)
├── 400g  (variant — bedava)
├── 2kg   (variant — bedava)
└── 10kg  (variant — bedava)
```

FREE 50 parent + sınırsız variant → pratik olarak 150-250 ürün varyasyonu (3-5 variant ortalama).
PRO 500 parent + sınırsız variant → 1.500-2.500 varyasyon.
PRO+ sınırsız parent → büyük chain için yeterli.

---

## 3. Özellikler Karşılaştırma (2026-05-22 Karar A revize — 4 farklılaşma)

| Özellik | FREE | PRO | PRO+ |
|---|:---:|:---:|:---:|
| **Stok limiti** | 50 | 500 | ∞ |
| **Vitrin limiti** (yeni 2026-05-22) | **10** | **500** | **∞** |
| **Şube sayısı** (yeni 2026-05-22) | **1** | **∞** | **∞** |
| **Excel ürün import** (yeni 2026-05-22) | ❌ | ✅ | ✅ |
| **Gelişmiş raporlar /admin/reports** (yeni 2026-05-22) | ❌ | ✅ | ✅ |
| Kullanıcı sayısı | ∞ | ∞ | ∞ |
| Stok hareketleri ledger | ∞ | ∞ | ∞ |
| Variant sistemi | ✅ | ✅ | ✅ |
| Telegram bildirim (admin uyarı) | ✅ | ✅ | ✅ |
| Düşük stok + akıllı sipariş | ✅ | ✅ | ✅ |
| Sayım workflow | ✅ | ✅ | ✅ |
| Transfer (şubeler arası) | ✅ (1 şube → transfer yok) | ✅ | ✅ |
| Pano + temel KPI | ✅ | ✅ | ✅ |
| CSV/Excel export | ✅ | ✅ | ✅ |
| PDF rapor | ✅ | ✅ | ✅ |
| PetPro Asistanı (rule-based) | ✅ | ✅ | ✅ |
| Audit log | ✅ | ✅ | ✅ |
| 2FA TOTP | ✅ | ✅ | ✅ |
| Merkezi vitrin (`petstockpro.com/vitrin`) | ✅ (10 ürün limit) | ✅ (500) | ✅ (∞) |
| Vitrin Metrikleri | ✅ | ✅ | ✅ |
| Stok 0 → vitrin'den otomatik çekme | ✅ | ✅ | ✅ |
| Satışa Aç toggle + Doğrula validation | ✅ | ✅ | ✅ |
| KVKK veri export | ✅ | ✅ | ✅ |
| Nilvera e-Arşiv entegrasyonu ¹ | ✅ | ✅ | ✅ |

> ¹ **e-Arşiv önkoşulları (MANTIK-HATALARI O8 — 2026-05-14):** Plan tablosunda "✅" görmek "anında çalışır" anlamına gelmez. e-Arşiv kullanmak için tenant'ın **vergi mükellefi olması** + **TÜBİTAK SM mali mühür** (~750 ₺/yıl) + **GİB e-Arşiv başvurusu** (onay 1-2 hafta) + **Nilvera kontör aboneliği** (kullanım başına ücret) gerekir. Sadece stok takip için kullanan FREE/PRO/PRO+ tenant'lar bu adımları atlayabilir — e-Arşiv özelliği "hazır ama önkoşullu" olarak işaretlenir. İlk fatura kesme tıklamasında onboarding modal şartları açıklar. Detay: `PAYMENT-INTEGRATION.md §3`.

**Kapsam dışı (2026-05-14 doğrulandı):**
- ❌ Custom domain (kendi domain bağlama) — proje kapsamı dışı
- ❌ Custom CSS / white-label — kapsam dışı
- ❌ API erişimi + Webhook'lar (3. taraf entegrasyon) — kapsam dışı
- ❌ Öncelikli telefon destek — kapsam dışı
- ❌ Paddle (yurt dışı ödeme) — **TR-only kararı, kapsam dışı**
- ❌ EN locale + Frankfurter kur — **TR-only**, gizli (next-intl yapısı kalır, ileride açılabilir)
- 📅 Bayi Admin — Faz 3 (multi-tenant viewer, plan'dan bağımsız ayrı karar)

### 3.1 Vergi Numarası Akışı (2026-05-13 kararı, korundu)

| Aşama | Vergi no davranışı |
|---|---|
| Kayıt formu | **SORULMUYOR** (sadece şirket adı + email + şifre + il/ilçe) |
| Onboarding | Şirket Profili widget — opsiyonel, atlanabilir |
| 1 ay sonra | E-posta + Telegram + ekran banner: *"Hesabını tamamlamayı unutma"* (askıya almaz) |
| **"Satışa Aç" toggle** | **Tetikleyici** — modal: *"Vitrin'de satışa açmak için vergi mükellefi olmalısın"* |
| Hesap askıya alma | **ASLA otomatik askıya alınmaz** — sadece stok takip için kullanan tenant'a vergi no zorunlu değil |

**Felsefe:** Pet shop sahibi sadece "stok defteri" olarak kullanıyorsa hiçbir şey isteme. Vitrin'de para kazanmak istiyor → o zaman vergi mükellefi ol.

### 3.2 Bayi Admin Rolü (Faz 3 — 2026-05-13 eklendi, plan'dan bağımsız)

**Senaryo:** Aynı kişi/işbirliği iki ayrı pet shop tenant'ı işletiyor. İki tenant'ı tek dashboard'da **read-only** izlemek için.

**Plan etkisi:** YOK — hem Bayi Admin hesabı hem izlenen tenant'lar kendi planlarında. Bayi Admin ek ücret YOK.

**MVP'de:** Schema + enum hazır (DATABASE-SCHEMA §3.9), UI Faz 3'te eklenir.

---

## 4. Limit Yaklaşma Mantığı

### 4.1 KPI Ring Rengi (Pano "Aktif Ürün")

```
FREE / PRO (sınırlı planlar):
  Kullanım %0-60   → 🟢 Yeşil   (--arrow)    "Plan'da yer var"
  Kullanım %60-80  → 🟠 Turuncu (--cat)      "Limit'e X ürün kaldı"
  Kullanım %80-100 → 🔴 Kırmızı (--danger)   "Limit dolmak üzere · Yükselt"
  Kullanım %100    → ⛔ Kırmızı + ek mesaj    "Limit doldu · Yükselt veya arşivle"

PRO+ (sınırsız):
  Ring yok, "∞ Sınırsız" gösterilir
```

### 4.2 Plan Yaklaşma Tetikleri

| Eşik | Aksiyon (FREE / PRO) |
|---|---|
| %80 (40/50 FREE veya 400/500 PRO) | Üst banner "Limit'e yaklaştın · Bir üst plana yükselt" |
| %95 (47/50 veya 475/500) | E-posta + Telegram uyarısı "Plan limit'iniz dolmak üzere" |
| %100 (50/50 veya 500/500) | Yeni ürün eklemek bloklanır (modal: yükselt veya arşivle) |

### 4.3 Plan Aşımı Engelleme (Backend)

```ts
// Server Action: createProduct
const activeCount = await db.select({ count: count() })
  .from(products)
  .where(eq(products.companyId, ctx.tenantId))
  .where(eq(products.isActive, true));

const limit = getPlanLimit(ctx.company.plan);
// FREE: 50 | PRO: 500 | PRO+: Infinity

if (activeCount + 1 > limit) {
  throw new PlanLimitError(402, {
    current: activeCount,
    limit,
    plan: ctx.company.plan,
    nextTier: getNextTier(ctx.company.plan), // FREE→PRO | PRO→PRO+ | PRO+→null
  });
}
```

**Race condition koruması:** Postgres unique constraint veya `SELECT ... FOR UPDATE` lock.

---

## 5. Ödeme ve Yükseltme

### 5.1 MVP (Manuel) — Sprint 0-12

- Tenant talep eder → admin paneli > Ayarlar > Plan > "PRO'ya / PRO+'ya Yükselt"
- "İletişime geç" mesajı + IBAN bilgisi gösterilir
- Tenant havale yapar + dekont yükler
- Süperadmin Plan Onay sekmesinde dekont görür → onaylar
- Plan **anında** aktif olur

### 5.2 Faz 2 — Otomatik (Sprint 13 — TR-only, 2026-05-14)

**TR-only kararı sonrası sadece TR ödeme:**

| Sağlayıcı | Rol | Sprint |
|---|---|---|
| 🇹🇷 iyzico Subscription API | Aylık otomatik tahsilat (3D Secure) | Sprint 13 |
| 🇹🇷 Nilvera | e-Arşiv fatura (TR yasal zorunluluk) | Sprint 14 |

**Kaldırılan (TR-only kararı):**
- ❌ Paddle MoR (yurt dışı ödeme) — proje kapsamı dışı
- ❌ KVKK Madde 9 yurt dışı veri aktarım açık rıza akışı — sadece KVKK iç aktarım
- ❌ GDPR cookie banner ek — sadece KVKK opt-out

### 5.3 İptal & Plan Düşürme

- Settings > Plan > "Aboneliği Sonlandır" veya "Daha düşük plana geç"
- İki onay sorulur
- **Dönem sonuna kadar** plan aktif kalır
- Dönem bitince otomatik FREE'ye veya seçilen tier'a düşer
- Veriler korunur (90 gün geri açma mümkün)

**Plan düşmesi sonrası limit aşımı:**
- PRO+ (∞) → PRO (500) düşerse → 500'den fazla ürün "Pasif modda" görünür
- PRO (500) → FREE (50) düşerse → fazlası "Pasif modda"
- Tenant manuel olarak hangilerini aktif tutmak istediğini seçer
- 30 gün içinde seçim yapılmazsa sistem **en yeni N ürünü aktif tutar** (N = yeni plan limiti)

---

## 6. Plan Yükseltme Mesajları (TR)

**TR-only kararı — EN mesajlar gizlendi, ileride açılabilir.**

```
FREE %80 banner:
"⚠ Plan limitine yaklaştın: {used}/50.
 PRO'ya yükselt — 500 ürün, 1.000 ₺/ay (KDV dahil)."

FREE %100 modal:
"FREE plan 50 ürün limitine ulaştın. Yeni ürün ekleyebilmek için:
 ○ PRO'ya yükselt (500 ürün — 1.000 ₺/ay)
 ○ Bir ürünü arşivle (limit altına in)
 Taslak olarak kaydedebilirsin (yayına alınmaz)"

PRO %80 banner:
"⚠ Plan limitine yaklaştın: {used}/500.
 PRO+'ya yükselt — sınırsız ürün, 2.000 ₺/ay (KDV dahil)."

PRO %100 modal:
"PRO plan 500 ürün limitine ulaştın. Yeni ürün ekleyebilmek için:
 ○ PRO+'ya yükselt (sınırsız ürün — 2.000 ₺/ay)
 ○ Bir ürünü arşivle (limit altına in)"

PRO+ — limit mesajı yok (∞)
```

---

## 7. Plan Migration (Faz 1 → Yeni Karar)

Sprint 0 öncesi henüz veri yok (yeni proje) → migration gerek yok, yeni limitlerle başlar.

**Gelecekteki limit değişiminde:**
- Plan değişimi bildirilir (e-posta + Telegram)
- 30 gün geçiş süresi tanınır
- Etkilenen tenant'lar ek ücretsiz süre alır (PR olarak)

---

## 8. Etkilenen Dokümanlar (2026-05-14 sonrası güncellenmesi gereken)

- ✅ `PLAN-KADEMELERI.md` (bu doküman) — 3-tier B
- ⏭ `DATABASE-SCHEMA.md §3.X planEnum` — FREE/PRO/PRO+ enum geri ekle
- ⏭ `CLAUDE.md` — 2026-05-14 yeni karar notu
- ⏭ `DEVAM-REHBERI.md` — sonuçlandırılmış kararlar listesi
- ⏭ `DEPLOYMENT.md §6.4` — net gelir tablosu 3-tier hesap
- ⏭ `PAYMENT-INTEGRATION.md` — Paddle kaldır
- ⏭ `SPRINT-PLAN.md` — Sprint 14 sadeleştir
- ⏭ `TECH-STACK.md` — TR-only sadeleme (Frankfurter, next-intl EN)
- ⏭ `EKRAN-AYARLAR.md §2.2` — Plan + Fatura sekmesi 3-tier
- ⏭ `EKRAN-URUNLER.md` — plan limit uyarısı 3-tier
- ⏭ `EKRAN-PUBLIC-VITRIN.md §13.6` — EN locale kısmı kaldır
- ⏭ `MARKA-VARLIKLARI.md` — meta description
- ⏭ `SUPERADMIN-YETKILERI.md` — plan referansları

---

## 9. Net Gelir Tahmini (DEPLOYMENT.md §6.4 ile uyumlu)

3-tier B kompozisyonu — 1.000 tenant senaryosu:

| Tier | Tenant payı | Tenant sayısı | Aylık fiyat | Brüt/ay |
|---|---:|---:|---:|---:|
| FREE | %70 | 700 | 0 ₺ | 0 ₺ |
| PRO | %25 | 250 | 1.000 ₺ | 250.000 ₺ |
| PRO+ | %5 | 50 | 2.000 ₺ | 100.000 ₺ |
| **Toplam** | — | **1.000** | — | **350.000 ₺** |

iyzico tahsilat ücreti %3 (-10.500) + OPEX (-7.500) + Mali müşavir (-2.500) = -20.500 ₺
Vergi öncesi kâr: 329.500 ₺ → Kurumlar vergisi %25 = -82.375 ₺
**NET: ~247.125 ₺/ay ≈ $8.240/ay** (2026-05-21 pricing 1.000/2.000 revize — önceki 1.250/2.250'de $10K, 750/1.750'de $6.4K)

> **Not (para akışı çizgisi):** "iyzico tahsilat ücreti %3" = iyzico'nun **bizim** PRO/PRO+ abonelik kart işlem ücreti (POS komisyonu eşdeğer). Pet shop'un müşterilerine sattığı ürünlerden komisyon almıyoruz — B2C para akışına dahil değiliz (bkz. `EKRAN-PUBLIC-VITRIN.md §13.4`).

Detay: `DEPLOYMENT.md §6.4`.

---

*Son güncelleme: 2026-05-21. **3-tier B (FREE 50 / PRO 500 / PRO+ Sınırsız) onaylandı. Pricing 2026-05-21 revize: PRO 1.000₺, PRO+ 2.000₺ (önceki Karar C 1.250/2.250'den düşürüldü, "fiyat artırmayalım" kullanıcı kararı). TR-only.***
