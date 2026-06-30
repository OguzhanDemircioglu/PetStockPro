# PLAN — PayTR 3D Secure CSP (ödeme sayfasına özel frame-src)

> Durum: ONAYLI (2026-06-30). Kullanıcı kararı: **B — gevşetme yalnız ödeme sayfasına özel**,
> her banka kartıyla ödeme çalışmalı, hiçbir detay atlanmamalı.

---

## 1. Problem

PayTR **canlı modda** kartla "Ödeme yap"a basınca 3D Secure pop-up'ı `ERR_BLOCKED_BY_CSP`
veriyor. Engellenen domainler bankaya/işleme göre değişiyor:
- `goguvenliodeme.bkm.com.tr` (BKM ortak güvenli ödeme)
- `inbound.apigateway.vakifbank.com.tr` (PayTR'ın acquirer/POS bankası VakıfBank gateway'i —
  **Garanti kartında bile** çıktı, çünkü işlem PayTR'ın anlaşmalı bankasından geçiyor)

Yani 3DS domaini **karttan bağımsız ve öngörülemez**: PayTR'ın acquirer altyapısı + kart
issuer'ının ACS'i, her ikisi de tahmin edilemez. Tek tek allowlist → her yeni banka/işlem
yolu = yeni `ERR_BLOCKED_BY_CSP` + yeni deploy (sürdürülemez whack-a-mole).

## 2. Kök neden (neden BİZİM CSP blokluyor?)

[billing-checkout.tsx](../src/app/admin/settings/billing/billing-checkout.tsx) ödeme
iframe'ini bizim sayfamıza gömüyor: `<iframe src="https://www.paytr.com/odeme/guvenli/...">`.
Bu iframe **bizim doğrudan çocuk browsing context'imiz**. PayTR ödeme adımında bu iframe'i
banka/acquirer ACS domainine **navigate ediyor** (aynı iframe location değişiyor). CSP
spesifikasyonu gereği bir dokümanın **doğrudan çocuk iframe'inin navigasyonunu** o dokümanın
`frame-src`'i yönetir. Dolayısıyla iframe paytr.com'dan vakifbank.com.tr'ye giderken **bizim
billing sayfamızın `frame-src`'i** devreye girip blokluyor (PayTR'ın CSP'si değil).

**Sonuç:** Düzeltme bizde (CSP), PayTR tarafında ayar GEREKMİYOR. Ve gevşetme yalnızca
**ödeme sayfası dokümanının** CSP'sinde olmalı (iframe orada).

## 3. Karar

| Sayfa | frame-src / form-action | Gerekçe |
|---|---|---|
| `/admin/settings/billing` (ödeme) | `'self' https:` | 3DS banka/acquirer ACS domainleri öngörülemez → tüm HTTPS frame'lere izin |
| Diğer TÜM sayfalar | `'self' https://challenges.cloudflare.com` (yalnız Turnstile) / `form-action 'self'` | PayTR iframe yalnız ödeme sayfasında; gerisi SIKI kalır |

- `frame-ancestors 'none'` (bizi kimsenin framelememesi — clickjacking koruması) **her yerde
  aynen korunur**. `frame-src` yalnız bizim NEYİ embed edebileceğimizi kontrol eder, kim bizi
  embed edebilir'i DEĞİL.
- Diğer tüm direktifler (default-src, script-src, style-src, img-src, connect-src, object-src,
  base-uri, upgrade-insecure-requests) **her iki profilde de aynı/sıkı**.
- **İyileştirme:** Strict `frame-src`'ten PayTR domainleri ÇIKARILDI (PayTR iframe yalnız ödeme
  sayfasında); strict sayfalar artık öncekinden de sıkı (yalnız Turnstile frame'i).

## 4. Mekanizma — neden `next.config` (middleware değil)

İki aday:
- **A) next.config `headers()` + negatif lookahead** ✅ SEÇİLDİ
- B) middleware'de path'e göre CSP set et ❌

middleware reddedildi çünkü: (1) middleware matcher tüm path'leri kapsamıyor (`/admin/:path*`
+ auth yolları); CSP'yi tüm sayfalara middleware'den vermek matcher'ı `/(.*)`'e genişletmeyi ve
her isteğe middleware maliyeti eklemeyi gerektirir (perf — CLAUDE.md middleware matcher notu).
(2) next.config `headers()` + middleware aynı header'ı (CSP) set ederse precedence belirsiz
(çift header → tarayıcı en katısını uygular → strict kazanır → gevşetme işe yaramaz).
next.config header eşleşmesi deterministik; tek yerde tutulur.

**Çift CSP header tuzağı:** Aynı path birden çok `headers()` kuralıyla eşleşip ikisi de CSP
verirse tarayıcı **kesişimi** uygular (en katı kazanır). Bu yüzden kurallar **karşılıklı
dışlayan** olmalı: ödeme path'i strict kuralının dışında bırakılır (negatif lookahead).

## 5. Teknik tasarım

### 5.1 `buildCsp(opts)` — tek fonksiyon, iki profil
```ts
function buildCsp(opts: { paymentPage?: boolean } = {}): string {
  const isPayment = opts.paymentPage === true;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com https://www.paytr.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co … (değişmedi)",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co … (değişmedi)",
    isPayment ? "frame-src 'self' https:" : "frame-src 'self' https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    isPayment ? "form-action 'self' https:" : "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}
```
- Yalnız `frame-src` ve `form-action` profile göre değişir. (form-action defansif: bilinen
  blok frame-src'te ama 3DS auto-submit form'ları için ödeme sayfasında da gevşetilir.)
- `script-src` her iki profilde www.paytr.com içerir (iframeResizer.min.js ödeme sayfasında
  yüklenir; strict sayfada zararsız, sade tutmak için ortak bırakıldı).

### 5.2 `headers()` — karşılıklı dışlayan 3 kural
```ts
const securityHeaders = [ X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
                          Permissions-Policy, X-DNS-Prefetch-Control ]; // CSP HARİÇ, ortak
return [
  { source: '/admin/settings/billing',         headers: [...securityHeaders, CSP(payment)] },
  { source: '/admin/settings/billing/:path*',  headers: [...securityHeaders, CSP(payment)] },
  { source: '/((?!admin/settings/billing).*)', headers: [...securityHeaders, CSP(strict)]  },
];
```
- Kural 1: ödeme sayfası tam yol → gevşek.
- Kural 2: ödeme alt-yolları + trailing slash → gevşek (gelecekteki alt-route + `/` normalize).
- Kural 3: diğer her şey → sıkı. Negatif lookahead `(?!admin/settings/billing)` ödeme prefix'ini
  hariç tutar → ödeme sayfası strict kuralıyla EŞLEŞMEZ → çift CSP header olmaz.
- Her path tam olarak BİR kurala düşer → tek CSP header garanti.

### 5.3 Bilinen sınır (gerçek route değil)
`/admin/settings/billingXYZ` gibi (billing ile başlayıp `/` ile devam etmeyen) **var olmayan**
bir path hiçbir kurala düşmez → CSP'siz olur. Böyle bir route YOK (404). Pratikte sorun değil;
gerekirse lookahead `(?!admin/settings/billing(?:/|$))` ile anchor'lanabilir (path-to-regexp `$`
davranışı test edilerek).

## 6. Güvenlik analizi

- **Gevşeyen:** Yalnız `/admin/settings/billing` sayfasında `frame-src`/`form-action` → `https:`.
  Bu sayfa **auth arkasında** (bayi sahibi girişli). Sayfanın NEYİ embed/POST edebileceğini açar.
- **Sıkı kalan (her yer):** `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`,
  `default-src 'self'`, script/style/img/connect allowlistleri. Diğer tüm sayfalarda frame-src
  yalnız Turnstile.
- **İstismar yüzeyi:** `frame-src https:` ancak sayfaya içerik enjekte edilebilirse (XSS) kötüye
  kullanılır; bizde zaten `script-src 'unsafe-inline'` var (Next.js gereği) → frame-src bizim
  birincil XSS savunmamız değil. Marjinal risk düşük, tek sayfaya kapsamlı.
- PCI/PayTR onboarding ödeme akışının çalışmasına bakar, CSP katılığına değil.

## 7. İzlenecek olası ileri durumlar (şimdi YAPILMAZ — bankaya özel çıkarsa eklenir)

"Hiçbir detay atlanmasın" için belgelenir ama spekülatif uygulanmaz (yanlış tahmin akışı bozar):
- **3DS2 biyometrik/WebAuthn:** Bazı bankaların passkey 3DS'i iframe'de
  `publickey-credentials-get` izni ister → hem `Permissions-Policy` hem PayTR iframe'inin
  `allow` attribute'u gerekebilir. Şu an `Permissions-Policy: camera=(), microphone=(),
  geolocation=(self)`; bir bankanın biyometrik 3DS'i takılırsa bu eklenir.
- **camera/microphone:** Şu an kapalı; nadir kamera-tabanlı 3DS bir bankada takılırsa gözden
  geçirilir.
- Bu durumlardan biri olursa belirti: ödeme akışı frame YÜKLENDİKTEN sonra (CSP değil) içeride
  takılır. O zaman ilgili izin + iframe `allow` eklenir.

## 8. Doğrulama planı

1. **typecheck + lint** 0 hata.
2. **Tam test paketi** yeşil (CSP'ye dair test yok — grep ile teyit; yoksa regresyon kontrolü).
3. **Local CSP header curl'ü (iki profil):**
   - `GET /admin/settings/billing` → `frame-src 'self' https:` + `form-action 'self' https:`,
     **tek** CSP header.
   - `GET /login` (veya `/admin`) → `frame-src 'self' https://challenges.cloudflare.com`,
     `form-action 'self'`, **tek** CSP header.
   - Hiçbir path'te çift CSP header olmadığını doğrula.
4. **Prod (deploy sonrası, kullanıcı):** Canlı modda **farklı bankalardan** birkaç kartla 3DS'e
   kadar git → `ERR_BLOCKED_BY_CSP` gitmiş olmalı. (Gerçek kart testi yalnız prod'da yapılabilir.)

## 9. Uygulama adımları (görevler)

1. Bu plan dosyası (✓).
2. `next.config.ts`: `buildCsp(opts)` refactor + global broad'u (geçici) scoped 3 kurala çevir.
3. Local doğrulama (typecheck/lint/test + iki profil curl + çift-header yok).
4. Commit + push.
5. Kullanıcı deploy + çoklu banka kart testi (prod).

## 10. Geri alma / alternatif

- Sorun çıkarsa: tek global strict CSP'ye dön (eski hâl) — ödeme yine bloklanır ama site güvenli.
- Daha da sıkı isteniyorsa (gelecekte): ödeme sayfasında `https:` yerine `*.com.tr` + bilinen
  `.com` bankalar (akbank.com/denizbank.com/...) allowlist'i — ama whack-a-mole riski geri gelir;
  bu yüzden şimdilik `https:` (kapsam garantisi) tercih edildi.
