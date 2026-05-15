# Ekran: Auth (Login + Register + Email Verification + Forgot Password + Onboarding)

> **Kapsam (2026-05-15):** PetStockPro'ya giriş, kayıt, email doğrulama, şifremi unuttum, email değiştirme, 2FA setup ve onboarding akışlarının tek toplu doc'u. Mevcut dağınık bilgileri (`EKRAN-AYARLAR §2.5` policy + `DATABASE-SCHEMA §3.1` users field'ları + `EKRAN-KULLANICILAR §4` davet hibrit + `DEVAM-REHBERI #9` şifre kuralları) konsolide eder. Sprint 2 implementation için tek source.

**Tarih:** 2026-05-15
**Sprint:** 2 (Tasarım sistemi + auth + onboarding)
**UI Mockup:** `preview/auth.html` (UI-MOCKUP-PLAN §5.5)
**Erişim:** Public unauthenticated (login öncesi)

---

## 0. Tasarım Felsefesi

- **Tek dil end-to-end (TR):** TR-only kararı, EN locale gizli (next-intl yapısı kalır, Faz 2)
- **Frankfurt veri lokasyonu açık rıza:** KVKK Madde 9 — kayıt formunda zorunlu checkbox (DEPLOYMENT §2.3)
- **Cloudflare Turnstile** bot koruması — Google reCAPTCHA değil (zero-latency Workers native, sıfır ek sub-processor)
- **NIST 2017+ şifre kuralları:** Zorla periyodik değişim YOK, kompleksite makul
- **Email enumeration koruması:** "Email var/yok" hiç ifşa edilmez, her form aynı mesajla yanıtlar
- **Audit log her aksiyona:** `audit_logs.action` ile tüm auth event'leri izlenir (giriş, başarısız deneme, şifre değişimi, 2FA aktif/kapat)
- **Tek geliştirici lens'i:** 3rd party hazır SDK (Auth.js v5 + Brevo + Turnstile) — custom auth kodu minimal

---

## 1. URL Haritası

| URL | Sayfa | Erişim |
|---|---|---|
| `/login` | E-posta + şifre + 2FA → JWT | Public |
| `/register` | Yeni hesap (e-posta + şifre + KVKK + Turnstile) | Public |
| `/verify-email?token=...` | Email doğrulama link tıklama hedefi | Public (token ile) |
| `/forgot-password` | Şifre sıfırlama isteği (e-posta + Turnstile) | Public |
| `/reset-password?token=...` | Yeni şifre belirle | Public (token ile) |
| `/accept-invite?token=...` | Davet kabul (hibrit: email/link — bkz. `EKRAN-KULLANICILAR §4`) | Public (token ile) |
| `/onboarding` | İlk şube + ilk ürün + opsiyonel vitrin (3 adım wizard) | Auth required (email verified) |
| `/2fa-setup` | TOTP QR + 8 recovery code (ayarlar dışı entry point) | Auth required |
| `/account-locked` | Hesap kilitli bilgi sayfası | Public |
| `/admin/settings/account/change-email` | Email değiştirme akışı başlatma | Auth required (ADMIN) |

---

## 2. Login Akışı

### 2.1 `/login` Sayfası

```
┌─────────────────────────────────────────────────┐
│  🐾 PetStockPro                                  │
│                                                  │
│  Hesabına Giriş Yap                              │
│                                                  │
│  E-posta *                                       │
│  [_______________________________]               │
│                                                  │
│  Şifre *                                         │
│  [_______________________________] [👁]          │
│  💡 Şifremi unuttum →                            │
│                                                  │
│  [Cloudflare Turnstile widget — sadece 5+      ] │
│  [başarısız sonrası görünür                    ] │
│                                                  │
│              [Giriş Yap]                         │
│                                                  │
│  ────────── veya ──────────                      │
│                                                  │
│  Hesabın yok mu? [Yeni Hesap Aç →]               │
└─────────────────────────────────────────────────┘
```

### 2.2 Backend Akışı

```typescript
// app/(auth)/login/route.ts
1. Body validation (Zod): { email, password, totp?, turnstileToken? }
2. Rate-limit check (Cloudflare KV):
   - 5 başarılı/başarısız deneme / 15 dk / IP — aşılırsa 429 (IP bazlı ek katman, DoS koruma)
3. Turnstile verify (eğer önceki ≥2 fail varsa zorunlu — kalan hak banner ile birlikte görünür)
4. users.email lookup (case-insensitive)
   - Bulunamadı → "Email veya şifre hatalı" (enumeration koruma — aynı mesaj, sayaç DA artmaz çünkü user yok)
5. lockedUntil > NOW() → 423 Locked (account-locked sayfasına redirect, geri sayım)
6. bcrypt.compare(password, user.passwordHash)
   - Yanlış → failedLoginAttempts++
     - 5'e ulaştıysa:
       • lockedUntil = NOW + 1 SAAT (2026-05-15 sıkı policy)
       • lockedReason = 'BRUTE_FORCE_1H'
       • consecutiveLockCount++ (art arda 3 lock olursa 24 saat kalıcı lock)
       • Brevo: "🔒 Hesabın güvenlik nedeniyle 1 saat kilitlendi" email (IP/UA/şehir + Şifremi Unuttum link)
       • Telegram: süperadmin alert (acil durum bildirim)
       • Response: 423 Locked
     - 5'in altında:
       • response: 401 + { remainingAttempts: 5 - failedLoginAttempts }
       • Frontend 2+ fail sonrası "X hakkınız kaldı" banner gösterir (§2.3)
   - Doğru → failedLoginAttempts=0, consecutiveLockCount=0, lastLoginAt=NOW()
7. emailVerified IS NULL ise:
   - 7 gün grace period kontrolü (createdAt > NOW - 7d ise giriş izin var)
   - Aksi → 403 Forbidden + verify-email yeniden tetikle
8. 2FA enabled ise:
   - totp boşsa → 200 with { requires2fa: true } (frontend 2FA input gösterir)
   - totp doluysa verify et (TOTP RFC 6238)
   - Yanlış → audit log + same generic error (TOTP yanlışı failedLoginAttempts'a SAYILMAZ — şifre doğru, sadece 2FA hatalı)
9. JWT signing (jose) — user_role + companyId + branchId claims
10. Cookie set (HttpOnly + Secure + SameSite=Lax + 7 gün)
11. Audit log: 'user.login_success' + metadata (ipHash, userAgent, country)
12. Redirect:
    - emailVerified yoksa → /verify-email
    - onboardingCompletedAt yoksa → /onboarding
    - else → /admin/dashboard
```

#### Sayaç Sıfırlama Mantığı

| Durum | failedLoginAttempts | consecutiveLockCount | lockedUntil |
|---|---|---|---|
| Başarılı login | 0 | 0 | NULL |
| Lock süresi geçince (kullanıcı tekrar girer) | 0 | korunur (art arda lock takibi) | NULL |
| Lock geçti + 24 saat içinde tekrar lock | 0 → her başarısızda artar | +1 | NOW + 1 saat |
| consecutiveLockCount = 3 olursa | — | 3 | NOW + 24 SAAT (kalıcı lock) + acil email + Telegram |
| Süperadmin Toolbox "Kilidi Aç" | 0 | 0 | NULL |
| Şifre sıfırlama tamamlandı | 0 | 0 | NULL |
| 7 gün lock olmadıysa | — | 0'a sıfırla (pg_cron) | NULL |

**24 saat içinde 3 art arda lock = ciddi saldırı sinyali.** Bu durumda 24 saat kalıcı lock + kullanıcıya acil email "Hesabına 3 kez art arda saldırı denendi, lütfen şifreni değiştir" + süperadmin Telegram **kritik** alert.

### 2.3 Hata Mesajları (Email Enumeration Koruması + Kalan Hak UX)

| Durum | Kullanıcıya gösterilen | İçten log |
|---|---|---|
| Email yok | "E-posta veya şifre hatalı" (sayaç artmaz) | `user.login_failed` + `reason='unknown_email'` |
| Şifre yanlış (1. veya 2.) | "E-posta veya şifre hatalı" | `user.login_failed` + `reason='wrong_password'` |
| Şifre yanlış (3.) | "E-posta veya şifre hatalı. **3 hakkın kaldı.**" | `user.login_failed` + `reason='wrong_password'` |
| Şifre yanlış (4.) | "E-posta veya şifre hatalı. **2 hakkın kaldı.** ⚠ Şifreni unuttun mu? → [Şifremi Unuttum]" | `user.login_failed` |
| Şifre yanlış (5.) | "E-posta veya şifre hatalı. **1 hakkın kaldı.** ⚠ Bir sonraki yanlışta hesabın 1 saat kilitlenecek." | `user.login_failed` |
| Şifre yanlış (6. — lock) | Redirect `/account-locked` (1 saat geri sayım + Şifremi Unuttum) | `user.login_locked` + `BRUTE_FORCE_1H` |
| Hesap pasif | "E-posta veya şifre hatalı" | `user.login_failed` + `reason='inactive'` |
| 2FA yanlış | "2FA kodu hatalı" (sayaç ARTMAZ — şifre doğruydu, 2FA hatalı) | `user.login_failed` + `reason='wrong_totp'` |
| Hesap kilitli (mevcut) | Redirect `/account-locked` | `user.login_locked` |
| Email doğrulanmamış (>7g) | "Önce e-postanı doğrulamalısın → [Yeniden Gönder]" | `user.login_unverified` |

#### Kalan Hak UX — Frontend Pattern

```typescript
// app/(auth)/login/login-form.tsx
const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

async function handleLogin(data) {
  const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });

  if (res.status === 423) {
    router.push('/account-locked');
    return;
  }

  if (res.status === 401) {
    const body = await res.json();
    setRemainingAttempts(body.remainingAttempts ?? null);
    // 2 fail sonrası Turnstile widget render et
    if (body.failedLoginAttempts >= 2) setShowTurnstile(true);
  }
}

// JSX:
{remainingAttempts !== null && remainingAttempts <= 3 && (
  <Banner variant={remainingAttempts === 1 ? 'danger' : 'warning'}>
    {remainingAttempts === 1
      ? '⚠ 1 hakkın kaldı. Bir sonraki yanlışta hesabın 1 saat kilitlenecek.'
      : `⚠ ${remainingAttempts} hakkın kaldı.`}
    {remainingAttempts <= 2 && (
      <Link href="/forgot-password">Şifremi unuttum →</Link>
    )}
  </Banner>
)}
```

**Görünüm zinciri (login formunda kalan hak banner'ı):**

```
1. yanlış → "E-posta veya şifre hatalı" (banner YOK)
2. yanlış → "E-posta veya şifre hatalı" (banner YOK)
3. yanlış → 🟡 "3 hakkın kaldı."
4. yanlış → 🟠 "2 hakkın kaldı. ⚠ Şifreni unuttun mu? → Şifremi unuttum"
5. yanlış → 🔴 "1 hakkın kaldı. ⚠ Bir sonraki yanlışta hesabın 1 saat kilitlenecek."
6. yanlış → 🔒 /account-locked (1 saat lock)
```

> **Neden 2. yanlıştan sonra göstermiyoruz?** Kullanıcı parmak hatasıyla 1-2 yanlış yapabilir, panik yaratmamak için ilk 2 yanlışta banner yok. 3. yanlış gerçek bir kafa karışıklığı sinyali — bu noktadan itibaren kullanıcıya yardımcı olmak şart (kalan hak + Şifremi Unuttum CTA).

> **Güvenlik vs UX trade-off:** Saldırgan da kalan hakkı görür ama: (1) zaten 5 deneme çok kısa, (2) Cloudflare KV IP rate-limit (5/15dk) ek katman, (3) gerçek kullanıcının parmak hatasını çözmek güvenliğin önünde — şeffaflık seçildi.

### 2.4 2FA Adımı

```
┌─────────────────────────────────────────────────┐
│  🐾 PetStockPro · 2FA                            │
│                                                  │
│  Doğrulama kodu                                  │
│  Authenticator uygulamandan 6 haneli kodu gir   │
│                                                  │
│  [_] [_] [_] [_] [_] [_]                         │
│                                                  │
│              [Doğrula]                           │
│                                                  │
│  Telefonun yanında değil mi?                     │
│  [Recovery code kullan →]                        │
└─────────────────────────────────────────────────┘
```

Recovery code 8 adet üretilir (2FA setup'ta), her biri tek kullanımlık. Kullanıldığında `twoFaRecoveryCodes[i].usedAt = NOW()` set edilir.

---

## 3. Register Akışı

### 3.1 `/register` Sayfası

```
┌──────────────────────────────────────────────────┐
│  🐾 PetStockPro                                   │
│                                                   │
│  Yeni Pet Shop Hesabı Aç                          │
│  Ücretsiz · FREE plan 50 ürün                    │
│                                                   │
│  Pet shop adı *                                   │
│  [_______________________________]                │
│  💡 Vitrin'de görünecek isim                      │
│                                                   │
│  E-posta *                                        │
│  [_______________________________]                │
│  💡 Her tenant için ayrı email gerekir. Aynı     │
│  kişinin 2 pet shop'u varsa Gmail "+" alias      │
│  kullanabilir (ahmet+mavi@gmail.com).            │
│                                                   │
│  Şifre *                                          │
│  [_______________________________] [👁]           │
│  💡 En az 8 karakter, 1 rakam, 1 büyük harf      │
│  [▓▓▓▓░░░░] Orta — İyi şifre kullan              │
│                                                   │
│  Şifre tekrar *                                   │
│  [_______________________________]                │
│                                                   │
│  ☐ KVKK Aydınlatma Metni'ni okudum, onaylıyorum  │
│    📄 Aydınlatma Metni →                          │
│                                                   │
│  ☐ Verilerimin Frankfurt (Almanya) veri          │
│    merkezinde saklanmasına açık rızam var        │
│    KVKK Madde 9 — DEPLOYMENT §2.3 detay →        │
│                                                   │
│  [🛡 Cloudflare Turnstile — görünmez/widget]    │
│                                                   │
│              [Hesap Oluştur]                      │
│                                                   │
│  Hesabın var mı? [Giriş Yap →]                    │
└──────────────────────────────────────────────────┘
```

### 3.2 Form Validation

| Alan | Kural | Hata mesajı |
|---|---|---|
| Pet shop adı | 3-100 char, trim, unique olmasına gerek YOK | "Pet shop adı en az 3 karakter" |
| E-posta | RFC 5322 + DNS MX check (Brevo SDK) | "Geçerli bir e-posta gir" |
| Şifre | Min 8 char, en az 1 rakam, 1 büyük harf, **HaveIBeenPwned API check** (k-anonymity) | "Şifre yeterli güçte değil" / "Bu şifre bilinen veri sızıntılarında bulundu" |
| Şifre tekrar | Şifreyle aynı | "Şifreler eşleşmiyor" |
| KVKK checkbox | Zorunlu | "Aydınlatma metnini onaylamalısın" |
| Frankfurt veri lokasyonu | Zorunlu | "Veri lokasyonu açık rızası zorunlu (KVKK Madde 9)" |
| Turnstile | Server-side verify | "Bot koruması doğrulanamadı, yeniden dene" |

### 3.3 Backend Akışı

```typescript
// app/(auth)/register/route.ts
1. Rate-limit (Cloudflare KV): 3 register / IP / 24 saat (toplu hesap açma koruması)
2. Turnstile verify (server-side, env.TURNSTILE_SECRET)
3. Body validation (Zod schema)
4. HIBP password check (api.pwnedpasswords.com k-anonymity, ~200ms)
   - Compromised → reddet, kullanıcıya genel hata
5. users.email UNIQUE check
   - Çakışma → "Bu e-posta zaten kayıtlı" (email enumeration risk ama register'da kabul edilebilir — duplicate önleme gerekli)
6. Transaction:
   - companies INSERT (status='active', plan='FREE', storefrontStatus='pending', vatNo=NULL)
   - users INSERT (companyId, email, passwordHash bcrypt cost 12, role='ADMIN', branchId=NULL, status='active', emailVerified=NULL, emailVerificationToken=crypto.randomUUID(), emailVerificationExpiresAt=NOW+24h, kvkkConsentedAt=NOW(), dataLocationConsentedAt=NOW())
   - audit_logs INSERT 'user.register' + 'company.create'
7. Brevo SMTP: doğrulama email gönder
   - Subject: "🐾 PetStockPro'ya hoş geldin — E-postanı doğrula"
   - Link: https://petstockpro.com/verify-email?token={token}
   - 24 saat geçerli + cooldown notu
8. JWT sign + cookie set (kullanıcı giriş yapmış sayılır, 7 gün grace ile)
9. Redirect: /verify-email (email doğrulama bekleme sayfası)
```

### 3.4 KVKK Çift Checkbox Mantığı

**Neden iki ayrı checkbox?**

| Checkbox | KVKK referansı | Anlamı |
|---|---|---|
| ☐ Aydınlatma Metni'ni okudum | KVKK Madde 10 (Aydınlatma yükümlülüğü) | Veri sorumlusunun kim olduğu, hangi veri toplanır, hangi amaçla kullanılır bilgisi alındı |
| ☐ Frankfurt veri lokasyonu açık rızam | KVKK Madde 9 (Yurt dışı aktarım) | Verinin AB'ye aktarımına özel açık rıza |

İki ayrı checkbox **şart** çünkü KVKK Madde 9 yurt dışı aktarım için ayrı açık rıza istiyor. Tek checkbox "her şeyi kabul ediyorum" KVKK'ya uymaz.

---

## 4. Email Doğrulama

### 4.1 `/verify-email` Sayfası (Bekleme — Email Tıklamadan Önce)

```
┌─────────────────────────────────────────────────┐
│  📧 E-postanı kontrol et                         │
│                                                  │
│  ahmet@petshop.com adresine doğrulama bağlantısı │
│  gönderildi. 24 saat içinde tıkla.              │
│                                                  │
│  💡 E-posta gelmedi mi?                          │
│     • Spam klasörünü kontrol et                  │
│     • 60 sn sonra "Yeniden Gönder" aktif olur    │
│                                                  │
│              [Yeniden Gönder (54 sn)]            │
│                                                  │
│  Yanlış e-posta mi yazdın?                       │
│  [E-posta düzelt →] (sadece doğrulanmamışken)    │
└─────────────────────────────────────────────────┘
```

### 4.2 `/verify-email?token=...` Tıklama Hedefi

```typescript
// app/(auth)/verify-email/route.ts
1. Token validation (URL param)
2. users WHERE emailVerificationToken=$1 AND emailVerificationExpiresAt > NOW()
   - Bulunamadı → "Bağlantı geçersiz veya süresi dolmuş → [Yeniden Gönder]"
3. UPDATE users SET emailVerified=NOW(), emailVerificationToken=NULL, emailVerificationExpiresAt=NULL
4. audit_logs: 'user.email_verified'
5. Brevo: "Hoş geldin" email (welcome message + onboarding teşviki)
6. Redirect: /onboarding (eğer ilk şube yoksa) veya /admin/dashboard
```

### 4.3 Resend Mekanizması

| Kural | Değer |
|---|---|
| Cooldown | 60 sn (frontend countdown) |
| Günlük limit | 5 kez / 24 saat / user |
| Backend rate-limit | Cloudflare KV: `email_verify_resend:${userId}` |
| Resend her seferinde | Yeni token üretilir, eski expire edilir |

Cooldown geçtikten sonra `[Yeniden Gönder]` butonu aktif olur. Tıklarsa → POST `/api/auth/resend-verification` → yeni token + email.

### 4.4 7 Gün Grace Period

Email doğrulanmadan da kullanıcı giriş yapabilir, 7 gün boyunca. Bu süre içinde:
- ✅ Login + tüm admin paneli erişim
- ✅ Onboarding tamamlama
- ⚠ Banner gösterilir: "📧 E-postan doğrulanmadı. 5 gün kaldı → [Şimdi Doğrula]"

7 gün sonra:
- ❌ Login engellenir (403)
- Sadece email doğrulama veya email değiştirme yapılabilir
- Email gönderilir: "Hesabın kilitlendi — e-postanı doğrula"

pg_cron günlük job:
```sql
SELECT cron.schedule('email_unverified_lockout', '0 5 * * *', $$
  UPDATE users SET status='inactive', lockedUntil = NOW() + INTERVAL '1 year'
  WHERE emailVerified IS NULL
    AND createdAt < NOW() - INTERVAL '7 days'
    AND status = 'active';
$$);
```

---

## 5. Şifremi Unuttum Akışı

### 5.1 `/forgot-password` Sayfası

```
┌─────────────────────────────────────────────────┐
│  🔑 Şifremi Unuttum                              │
│                                                  │
│  Hesap e-postanı gir, sana sıfırlama bağlantısı  │
│  göndereceğiz.                                   │
│                                                  │
│  E-posta *                                       │
│  [_______________________________]               │
│                                                  │
│  [🛡 Cloudflare Turnstile widget — ZORUNLU]    │
│                                                  │
│              [Sıfırlama Bağlantısı Gönder]       │
│                                                  │
│  Şifren aklına geldi mi? [Giriş Yap →]           │
└─────────────────────────────────────────────────┘
```

### 5.2 Backend Akışı

```typescript
// app/(auth)/forgot-password/route.ts
1. Rate-limit: 3 istek / IP / saat (Cloudflare KV)
2. Turnstile verify (ZORUNLU — kullanıcının özel sorduğu yer)
3. users.email lookup (case-insensitive)
4. ⚠ ENUMERATION KORUMA: Email var/yok ayrımı yapılmaz!
   - Email varsa: token üret + email gönder
   - Email yoksa: hiçbir şey yapma (sadece 200 dön)
   - Kullanıcıya her iki durumda da AYNI mesaj:
     "Eğer bu e-posta kayıtlıysa, sıfırlama bağlantısı gönderildi. 30 dakika içinde tıkla."
5. UPDATE users SET passwordResetToken=crypto.randomUUID(), passwordResetExpiresAt=NOW+30dk
6. Brevo SMTP gönder:
   - Subject: "🔑 PetStockPro şifre sıfırlama"
   - Link: https://petstockpro.com/reset-password?token={token}
   - 30 dakika geçerli + tek kullanımlık uyarısı
   - "Sen istemediysen bu mesajı görmezden gel" notu
7. audit_logs: 'user.password_reset_requested' + metadata (ipHash, userAgent)
```

### 5.3 `/reset-password?token=...` Sayfası

```
┌─────────────────────────────────────────────────┐
│  🔑 Yeni Şifre Belirle                           │
│                                                  │
│  ahmet@petshop.com için yeni şifre belirle      │
│                                                  │
│  Yeni Şifre *                                    │
│  [_______________________________] [👁]          │
│  💡 En az 8 karakter, 1 rakam, 1 büyük harf     │
│  [▓▓▓▓▓░░░] Güçlü                                │
│                                                  │
│  Şifre tekrar *                                  │
│  [_______________________________]               │
│                                                  │
│  ⚠ Şifreni değiştirdiğinde TÜM aktif            │
│    oturumların kapanır (güvenlik gereği)         │
│                                                  │
│              [Şifreyi Belirle]                   │
└─────────────────────────────────────────────────┘
```

### 5.4 Backend Akışı (Reset)

```typescript
// app/(auth)/reset-password/route.ts
1. Token validation + Zod schema (password kuralları)
2. users WHERE passwordResetToken=$1 AND passwordResetExpiresAt > NOW()
   - Bulunamadı → "Bağlantı geçersiz veya süresi dolmuş"
3. HIBP password check (yeni şifre)
4. Geçmiş 3 şifre kontrolü (passwordHistory jsonb son 3 bcrypt hash)
   - Aynısı → "Son 3 şifrenden farklı bir şifre seç"
5. Transaction:
   - UPDATE users SET passwordHash=bcrypt(new), passwordResetToken=NULL, passwordResetExpiresAt=NULL, passwordChangedAt=NOW(), passwordHistory=array_append(...), failedLoginAttempts=0, lockedUntil=NULL
   - DELETE FROM sessions WHERE userId=$1 (tüm aktif oturumlar invalidate)
6. Brevo: "Şifren değiştirildi" uyarı email (sen değiştirmediysen acil destek)
7. audit_logs: 'user.password_reset_completed' + metadata
8. Telegram bot: kullanıcı bağlıysa "Şifren değiştirildi" bilgi mesajı (opsiyonel)
9. Redirect: /login (yeni şifreyle gir)
```

### 5.5 Email Enumeration Koruma Detayı

**Saldırı senaryosu (koruma yoksa):**
- Saldırgan `/forgot-password` formuna 1000 farklı email girer
- Backend "Email yok" derse → email kayıtlı mı listesi çıkarılabilir
- Bu liste pazarlanır veya brute force için kullanılır

**Koruma stratejisi:**
- Backend her zaman 200 + aynı mesaj döner
- Sadece varsa email gönderilir
- Frontend "kayıtlı değilse mesaj gelmez" der ama saldırgan ayırt edemez

**Yan etki:** Gerçek kullanıcı yanlış email girmiş → mesaj gelmez → kafa karışır. Çözüm: Mesajda "spam klasörünü kontrol et, gelmezse e-postan kayıtlı değil olabilir" notu eklenir.

---

## 6. Email Değiştirme Akışı

### 6.1 Çift Doğrulama (Sprint 9 — Settings > Hesap)

Hesap ele geçirme korumasında **eski + yeni email** her ikisinden de doğrulama:

```
1. /admin/settings/account/change-email
   ┌────────────────────────────────────────┐
   │ Mevcut e-posta: ahmet@petshop.com       │
   │                                          │
   │ Yeni e-posta *                          │
   │ [ahmet_new@petshop.com]                 │
   │                                          │
   │ Mevcut şifren *                         │
   │ [____________]                          │
   │                                          │
   │ [🛡 Turnstile widget]                  │
   │                                          │
   │     [Değişikliği Başlat]                │
   └────────────────────────────────────────┘

2. Backend:
   - Şifre doğrula (re-auth)
   - UPDATE users SET pendingEmail='ahmet_new@...', pendingEmailToken=UUID, pendingEmailExpiresAt=NOW+24h
   - Eski email'e: "📧 E-posta değişikliği isteği — sen istemediysen [İptal Et]"
   - Yeni email'e: "📧 Yeni e-postanı doğrula → [Tıkla]"

3. Yeni email tıklarsa: /verify-email-change?token=...
   - UPDATE users SET email=pendingEmail, pendingEmail=NULL, pendingEmailToken=NULL, emailVerified=NOW()
   - Eski email'e final bildirim: "E-postan değiştirildi" 
   - audit_logs: 'user.email_changed' + metadata (oldEmail, newEmail)

4. Eski email "İptal Et" tıklarsa: /cancel-email-change?token=...
   - UPDATE users SET pendingEmail=NULL, pendingEmailToken=NULL
   - audit_logs: 'user.email_change_cancelled'
   - Telegram süperadmin alert (hesap ele geçirme şüphesi olabilir)
```

### 6.2 Edge Case'ler

| Durum | Davranış |
|---|---|
| Yeni email başka tenant'ta kullanılıyor | "Bu e-posta zaten kayıtlı" hatası (önce token üretilmeden check) |
| 24 saat içinde doğrulanmadı | pendingEmail temizlenir (pg_cron) |
| Aynı anda 2 farklı değişim isteği | İkincisi öncekini override eder, eski email yine "iptal et?" mesajı alır |
| Email değişimi sırasında şifre değişimi | Bağımsız akış, ayrı doğrulama |

---

## 7. 2FA Setup Akışı

### 7.1 `/admin/settings/security/2fa` veya İlk Setup `/2fa-setup`

```
┌──────────────────────────────────────────────────┐
│  🛡 İki Faktörlü Kimlik Doğrulama Aktif Et       │
│                                                   │
│  Hesabın güvenliği için Authenticator uygulaması  │
│  kullan (Google Authenticator, Authy, 1Password). │
│                                                   │
│  Adım 1/3: QR kodu tara                           │
│  ┌─────────────────┐                             │
│  │   ███▀▀▀▀▀▀▀███ │                             │
│  │   █  ▀▀▀▀▀▀▀  █ │  Manuel anahtar:           │
│  │   █  ▀▀▀▀▀▀▀  █ │  JBSWY3DPEHPK3PXP          │
│  │   █  ▀▀▀▀▀▀▀  █ │                             │
│  │   ███▀▀▀▀▀▀▀███ │                             │
│  └─────────────────┘                             │
│                                                   │
│  Adım 2/3: 6 haneli kodu gir                     │
│  [_] [_] [_] [_] [_] [_]                          │
│                                                   │
│              [Doğrula ve Devam]                   │
└──────────────────────────────────────────────────┘
```

### 7.2 Recovery Codes (Adım 3/3)

```
┌──────────────────────────────────────────────────┐
│  🔐 Yedek Kodlar                                  │
│                                                   │
│  Telefonun yanında olmadığında kullan. 8 adet,   │
│  her biri TEK KULLANIMLIK.                        │
│                                                   │
│   ABCD-EFGH      MNOP-QRST                       │
│   IJKL-9MNO      UVWX-YZ12                       │
│   1234-5678      ABCD-9876                       │
│   QWER-TYUI      ASDF-GHJK                       │
│                                                   │
│  [📋 Kopyala]  [📥 Yazıcıya Gönder]              │
│                                                   │
│  ⚠ Bu kodları güvenli yerde sakla — bir daha    │
│    göremezsin. Hashed olarak saklanır.           │
│                                                   │
│  ☐ Yedek kodları kaydettim                       │
│                                                   │
│              [2FA'yı Aktif Et]                    │
└──────────────────────────────────────────────────┘
```

### 7.3 Backend Akışı

```typescript
1. POST /api/auth/2fa/init → speakeasy.generateSecret(32 bytes base32)
   - Geçici DB save (twoFaSetupSecret + twoFaSetupExpiresAt 10 dk)
   - QR URI: otpauth://totp/PetStockPro:ahmet@petshop.com?secret=...
2. POST /api/auth/2fa/verify-setup { totp } → speakeasy.totp.verify
   - Yanlış → "Kod hatalı, tekrar dene"
   - Doğru → recovery codes üret (8 × 8 karakter, format ABCD-EFGH)
     - SHA256 hash array olarak DB'ye yaz: [{ hash: 'a1b2...', usedAt: null }, ...]
3. POST /api/auth/2fa/enable { recoveryCodesAcknowledged: true }
   - UPDATE users SET twoFaEnabled=true, twoFaSecret=(encrypted at rest Faz 2), twoFaRecoveryCodes=jsonb, twoFaEnabledAt=NOW()
   - audit_logs: 'user.2fa_enabled'
   - Brevo: "2FA aktif edildi" bilgi email
```

### 7.4 2FA Kapama (Şifre Re-Auth)

`/admin/settings/security/2fa` → "Kapat" → şifre doğrula → `twoFaEnabled=false` + recovery codes silinir + audit log + email bildirim.

### 7.5 Recovery Code Kullanımı

Login'de "Recovery code kullan" → 8 karakter format input → backend tüm hash'leri eşleştir → bulursa `usedAt=NOW()` set, 2FA bypass + login. Kullanılan kod tekrar kullanılamaz.

8 kodun hepsi kullanıldıysa → kullanıcıya "Yeni recovery codes üret" bildirimi (login sonrası banner). Süperadmin Toolbox'tan da 2FA reset yapılabilir.

---

## 8. Onboarding 3 Adım Wizard

### 8.1 `/onboarding` Akışı

Register + email verify sonrası ilk giriş → onboarding redirect (eğer `onboardingCompletedAt IS NULL`).

```
Adım 1/3: İlk Şube Ekle
┌──────────────────────────────────────────────────┐
│  🏪 İlk Şubeni Tanımla                            │
│                                                   │
│  Şube adı *           [Merkez]                    │
│  İl *                 [İstanbul ▼]                │
│  İlçe *               [Kadıköy ▼]                 │
│  Adres *              [textarea]                  │
│  Telefon              [0212___]                   │
│  WhatsApp (opsiyonel) [0532___]                   │
│  Çalışma saatleri     [09:00 - 19:00 ▼]          │
│                                                   │
│  [⏭ Atla]                    [Devam →]            │
└──────────────────────────────────────────────────┘

Adım 2/3: İlk Ürünü Ekle
┌──────────────────────────────────────────────────┐
│  📦 İlk Ürünü Kataloga Ekle                       │
│                                                   │
│  Ürün adı *           [Royal Canin 2kg]           │
│  Kategori *           [Mama ▼]                    │
│  Stok                 [10] adet                   │
│  Alış fiyatı (₺)      [120]                       │
│  Satış fiyatı (₺) *   [180]                       │
│  Barkod (opsiyonel)   [3033xxxxxxxxx]             │
│                                                   │
│  💡 Hızlıca eklemek için bu form sadeleştirildi.  │
│  Ürünler sayfasında variant, KDV, görsel, açıklama│
│  vs. ekleyebilirsin.                              │
│                                                   │
│  [← Geri] [⏭ Atla]            [Devam →]           │
└──────────────────────────────────────────────────┘

Adım 3/3: Vitrin Profili (Opsiyonel)
┌──────────────────────────────────────────────────┐
│  🌐 Vitrin'de Müşterilere Görün                   │
│                                                   │
│  petstockpro.com/vitrin/magaza/[mavi-pet-shop]   │
│  💡 Müşteriler seni vitrin'den bulup WhatsApp ile │
│  iletişime geçebilir. (B2C — biz aracı değiliz,   │
│  para akışı sende, EKRAN-PUBLIC-VITRIN §13.4)    │
│                                                   │
│  Slug *               [mavi-pet-shop]             │
│  💡 vitrin URL'i — sonradan değiştirilemez!      │
│                                                   │
│  Vitrin açıklama      [textarea — 200 char]       │
│  Vitrin görseli       [Yükle] (logo veya kapak)   │
│                                                   │
│  ☐ Vitrin'i sonra hallederim                     │
│                                                   │
│  [← Geri]                    [Vitrin'i Yayınla →] │
└──────────────────────────────────────────────────┘
```

### 8.2 Tamamlama

```typescript
// Adım 3 submit veya "Sonra Hallederim"
UPDATE users SET onboardingCompletedAt=NOW();
UPDATE companies SET storefrontStatus='approved' (eğer vitrin profili dolduruldysa)
                  OR storefrontStatus='disabled' (vitrin atlandıysa, "Satışa Aç" toggle ile sonra açabilir)
Redirect: /admin/dashboard
Telegram süperadmin: "Yeni tenant kayıt tamamladı: Mavi Pet Shop"
```

### 8.3 Onboarding Atla / Yarıda Kal

Her adımda "Atla" var. Atlanırsa:
- Şube yok → admin paneli "Hoş Geldin Banner" + "İlk şubeni ekle" CTA
- Ürün yok → Ürünler sayfası empty state mascot + "İlk ürünü ekle" CTA
- Vitrin yok → Settings > Vitrin sekmesi "Vitrin'ini aç" CTA

**Tek geliştirici lens'i:** Onboarding'in yarıda kalması **sorun değil** — kullanıcı kendi hızında ilerler.

---

## 9. CAPTCHA — Cloudflare Turnstile

### 9.1 Neden Turnstile, Google reCAPTCHA Değil?

| Boyut | Turnstile (önerim) | Google reCAPTCHA v3 |
|---|---|---|
| Maliyet | $0 limitsiz | $0 → $1/1K (1M üstü) |
| Workers entegrasyon | Native binding (sıfır latency) | API call (~50-150ms) |
| KVKK | Cloudflare zaten sub-processor | Google ek sub-processor → aydınlatma metni güncelleme |
| Açık rıza | Gerekmez | Üçüncü taraf, ek açık rıza gerekir |
| Türkiye performans | CF İstanbul edge | Google FE'den geç |
| Brand visibility | Sıfır veya 1cm widget | Footer "protected by reCAPTCHA" zorunlu |
| Setup | Cloudflare dashboard 2 tıkla | Google Cloud Console + key yönetimi |

### 9.2 Setup

```bash
# Cloudflare dashboard → Turnstile → New Site
# Domain: petstockpro.com
# Widget mode: Managed (otomatik invisible/widget)
# Site Key: env.TURNSTILE_SITE_KEY
# Secret Key: env.TURNSTILE_SECRET_KEY
```

```typescript
// wrangler.toml
[vars]
TURNSTILE_SITE_KEY = "0x4AAA..."

[[services]]
binding = "TURNSTILE"
service = "turnstile-verify"
```

### 9.3 Frontend Komponent

```tsx
// components/auth/turnstile-widget.tsx
'use client';

import { Turnstile } from '@marsidev/react-turnstile';

export function TurnstileWidget({ onSuccess }: { onSuccess: (token: string) => void }) {
  return (
    <Turnstile
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
      onSuccess={onSuccess}
      options={{ theme: 'light', size: 'normal', language: 'tr' }}
    />
  );
}
```

### 9.4 Backend Verify

```typescript
// lib/auth/verify-turnstile.ts
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
      remoteip: ip,
    }),
  });
  const data = await res.json();
  return data.success === true;
}
```

### 9.5 Hangi Formlarda Aktif?

| Form | CAPTCHA | Sebep |
|---|---|---|
| `/register` | ✅ **Zorunlu** | Bot tenant kayıt önlenmeli |
| `/forgot-password` | ✅ **Zorunlu** | Email enumeration + spam |
| `/change-email` | ✅ **Zorunlu** | Hesap ele geçirme korumasında ek katman |
| `/login` | 🟡 Conditional (5+ başarısız sonrası) | Sürekli UX bozar; threshold'lu |
| `/reset-password` | ❌ Yok | Token zaten brute-force korumalı (tek kullanımlık, 30 dk) |
| `/verify-email` | ❌ Yok | Token tabanlı, CAPTCHA gereksiz |
| `/accept-invite` | ❌ Yok | Token tabanlı, rate-limit yeter |

---

## 10. Account Lock + Recovery (2026-05-15 sıkı policy)

### 10.1 Brute Force Lock Mekaniği

> **2026-05-15 sıkılaştırma (kullanıcı kararı):** Önceki "10 başarısız → 15 dk" yetersizdi. Yeni policy: **5 başarısız → 1 SAAT lock** + 3 art arda lock olursa **24 saat kalıcı lock**. UX: 2 başarısızdan sonra kalan hak gösterilir.

```
failedLoginAttempts (counter, kullanıcı bazlı):
  0     → normal login akışı, banner YOK
  1     → "E-posta veya şifre hatalı" (banner YOK — parmak hatası varsayımı)
  2     → "E-posta veya şifre hatalı" (banner YOK)
  3     → 🟡 "3 hakkın kaldı." Turnstile widget görünür
  4     → 🟠 "2 hakkın kaldı. Şifremi unuttum →"
  5     → 🔴 "1 hakkın kaldı. Bir sonraki yanlışta hesabın 1 saat kilitlenecek."
  6 (= 5'inci başarısız bcrypt fail'ı counter 5'e ulaştırır) →
        🔒 lockedUntil = NOW + 1 SAAT
        lockedReason = 'BRUTE_FORCE_1H'
        consecutiveLockCount++
        Brevo email: "🔒 Hesabın güvenlik nedeniyle 1 saat kilitlendi"
          (IP, UA, şehir bilgisi + Şifremi Unuttum CTA)
        Telegram süperadmin: ⚠ kritik alert
        Response: 423 Locked → /account-locked redirect

consecutiveLockCount mantığı:
  1 lock (1 saat geçti, kullanıcı tekrar dener, hâlâ unutkan ise)
    → 5 başarısız → 2. lock (1 saat) → consecutiveLockCount=2
  3. art arda lock:
    → lockedUntil = NOW + 24 SAAT (kalıcı lock — saldırı sinyali)
    → lockedReason = 'BRUTE_FORCE_24H'
    → Brevo: ACİL email "Hesabına 3 kez art arda saldırı denendi"
    → Telegram: 🚨 saldırı şüphesi alert (süperadmin Toolbox müdahale önerisi)

Sayaç sıfırlama:
  • Başarılı login → failedLoginAttempts=0, consecutiveLockCount=0
  • Lock süresi geçti + kullanıcı tekrar girer → failedLoginAttempts=0 (consecutiveLockCount korunur)
  • Süperadmin Toolbox "Kilidi Aç" → her ikisi de 0 + lockedUntil=NULL
  • Şifre sıfırlama tamamlandı → her ikisi de 0 + lockedUntil=NULL
  • 7 gün hiç lock olmadıysa → consecutiveLockCount=0 (pg_cron weekly cleanup)
```

### 10.2 `/account-locked` Sayfası

```
┌─────────────────────────────────────────────────┐
│  🔒 Hesabın Geçici Olarak Kilitli                │
│                                                  │
│  Çok fazla başarısız giriş denendi (5).          │
│  ahmet@petshop.com hesabın 1 saat sonra          │
│  otomatik açılacak.                              │
│                                                  │
│  ⏱ Geri sayım: 58:43                              │
│                                                  │
│  Acil durumda:                                   │
│  • Şifreni unuttuysan → [Şifremi Unuttum]        │
│    (sıfırlama anında giriş yapabilirsin)         │
│  • Telefonun çalındıysa → [Destek →]             │
│                                                  │
│  💡 Sen değil miydin?                            │
│  Birisi hesabına giriş denedi. Şifreni           │
│  değiştirmen önerilir.                           │
│  E-postana ayrıntılı uyarı gönderdik (IP, UA,    │
│  konum).                                          │
└─────────────────────────────────────────────────┘
```

**24 saat kalıcı lock durumu (3 art arda lock):**
```
┌─────────────────────────────────────────────────┐
│  🔒🔒 Hesabın 24 Saat Kilitli (Saldırı Şüphesi) │
│                                                  │
│  3 kez art arda 5'er yanlış giriş denendi.       │
│  ahmet@petshop.com hesabın güvenlik nedeniyle    │
│  24 saat kilitlendi.                             │
│                                                  │
│  ⚠ Bu hesabına saldırı denemesi olabilir.        │
│                                                  │
│  Hemen şifreni değiştir:                         │
│  [Şifremi Unuttum →]                             │
│                                                  │
│  Yardım: destek@petstockpro.com                  │
└─────────────────────────────────────────────────┘
```

### 10.3 Şifremi Unuttum Kilidi Bypass Eder

Kullanıcı lockedUntil aktifken **"Şifremi Unuttum"** akışını kullanabilir:
- /forgot-password formu çalışır (lock kontrol etmez)
- Email gönderilir + token üretilir
- /reset-password sayfasında yeni şifre belirler
- Backend: `failedLoginAttempts=0, consecutiveLockCount=0, lockedUntil=NULL`
- Kullanıcı yeni şifreyle anında giriş yapabilir

Bu **UX kritik** — yoksa kullanıcı 1 saat beklemek zorunda kalır (gerçek "şifre unuttu" senaryosu).

### 10.4 Süperadmin Override

Süperadmin Toolbox FAB → "Hesap Kilidini Aç" → modal:
```
┌─────────────────────────────────────────────────┐
│  🛡 Süperadmin: Hesap Kilidini Aç                │
│                                                  │
│  Kullanıcı: ahmet@petshop.com                    │
│  Tenant: Mavi Pet Shop                           │
│                                                  │
│  Mevcut durum:                                   │
│  • lockedUntil: 12 Mayıs 14:23 (47 dk kaldı)     │
│  • lockedReason: BRUTE_FORCE_1H                  │
│  • consecutiveLockCount: 2                       │
│  • failedLoginAttempts: 5                        │
│                                                  │
│  Müdahale sebebi (audit için): *                 │
│  [textarea]                                       │
│                                                  │
│  ☐ Kullanıcıyı bilgilendir (e-posta gönder)      │
│                                                  │
│       [İptal]   [🔓 Kilidi Aç]                   │
└─────────────────────────────────────────────────┘
```

Submit → `UPDATE users SET failedLoginAttempts=0, consecutiveLockCount=0, lockedUntil=NULL` + `audit_logs` action='superadmin.bypass.account_unlock' + Telegram tenant'a bildirim (eğer checkbox işaretliyse).

---

## 11. State + API

```typescript
// Tüm auth endpoint'ler (özet)
| Endpoint | Method | Rate-limit | Turnstile |
|---|---|---|---|
| `/api/auth/login` | POST | 5/15dk/IP | 5+ fail sonrası |
| `/api/auth/register` | POST | 3/24h/IP | ✅ Zorunlu |
| `/api/auth/logout` | POST | — | — |
| `/api/auth/verify-email` | POST | — (token) | — |
| `/api/auth/resend-verification` | POST | 5/24h/user | — |
| `/api/auth/forgot-password` | POST | 3/saat/IP | ✅ Zorunlu |
| `/api/auth/reset-password` | POST | — (token) | — |
| `/api/auth/change-email/init` | POST | 3/24h/user | ✅ Zorunlu |
| `/api/auth/change-email/verify` | POST | — (token) | — |
| `/api/auth/change-email/cancel` | POST | — (token) | — |
| `/api/auth/2fa/init` | POST | — (auth) | — |
| `/api/auth/2fa/verify-setup` | POST | 5/15dk/user | — |
| `/api/auth/2fa/enable` | POST | — | — |
| `/api/auth/2fa/disable` | POST | — (re-auth) | — |
| `/api/auth/2fa/regenerate-recovery` | POST | 3/24h/user | — |
| `/api/auth/accept-invite` | POST | 5/dk/IP | — (token + KV) |
| `/api/auth/onboarding/complete` | POST | — | — |

// Audit log action'lar (varchar — esnek pattern, MANTIK-HATALARI S3)
'user.register'
'user.login_success'
'user.login_failed' (metadata.reason: unknown_email/wrong_password/wrong_totp/inactive)
'user.login_locked'
'user.logout'
'user.email_verified'
'user.email_change_started'
'user.email_changed'
'user.email_change_cancelled'
'user.password_reset_requested'
'user.password_reset_completed'
'user.2fa_enabled'
'user.2fa_disabled'
'user.2fa_recovery_used'
'user.2fa_regenerated'
'user.onboarding_completed'
'user.invited' (EKRAN-KULLANICILAR §4 hibrit davet)
'user.invite_accepted'
```

---

## 12. KVKK + Aydınlatma Metni

### 12.1 Çift Checkbox Mantığı (Register)

| Checkbox | KVKK | Açık rıza? | Zorunlu? |
|---|---|---|---|
| Aydınlatma metnini okudum | Madde 10 | Onay (bilgilendirme) | ✅ Şart |
| Frankfurt veri lokasyonu | Madde 9 | Açık rıza (özel) | ✅ Şart |

### 12.2 Aydınlatma Metni İçeriği (`/legal/aydinlatma` — Sprint 14)

- Veri sorumlusu: PetStockPro Ltd. (lansman öncesi şirket kuruluş)
- Toplanan veri: email, ad-soyad, telefon (opsiyonel), şifre hash, IP hash, user-agent
- Veri lokasyonu: **Frankfurt, Almanya (Supabase eu-central-1)** — KVKK Madde 9
- Saklama süresi: 5 yıl (KVKK Md.7) + 90 gün soft delete
- Sub-processor listesi: Supabase + Cloudflare + Brevo + iyzico + Nilvera + Telegram (Cloudflare Turnstile burada — Cloudflare zaten var, ek sub-processor değil)
- Kullanıcı hakları: KVKK Md.11 (erişim, silme, taşıma) + iletişim `kvkk@petstockpro.com`

### 12.3 Şifre Güvenliği KVKK

- bcrypt cost 12 hash — düz şifre saklanmaz
- Şifre değişim email uyarısı (kullanıcı bilgilendirme)
- 2FA opsiyonel (Md.12 önerilen güvenlik tedbiri)
- Recovery codes SHA256 hash (düz saklanmaz)

---

## 13. Test Senaryoları (AUTH-*)

### Login (AUTH-001..015 — 2026-05-15 sıkı brute-force policy)
- AUTH-001 Geçerli email + şifre → JWT cookie set, /admin/dashboard
- AUTH-002 1. yanlış şifre → "Email veya şifre hatalı" + failedLoginAttempts=1 + banner YOK
- AUTH-003 Bilinmeyen email → aynı generic hata + sayaç ARTMAZ (enumeration koruma)
- AUTH-004 2. yanlış → banner YOK (parmak hatası varsayımı), failedLoginAttempts=2
- AUTH-005 3. yanlış → 🟡 banner "3 hakkın kaldı" + Turnstile widget görünür
- AUTH-006 4. yanlış → 🟠 banner "2 hakkın kaldı + Şifremi unuttum linki"
- AUTH-007 5. yanlış → 🔴 banner "1 hakkın kaldı + sonraki yanlışta 1 saat kilit uyarı"
- AUTH-008 6. yanlış (counter 5'e ulaşır) → lockedUntil=NOW+1saat, lockedReason='BRUTE_FORCE_1H', consecutiveLockCount++, email + Telegram alert, 423 → /account-locked
- AUTH-009 /account-locked sayfası 1 saat geri sayım gösterir + Şifremi Unuttum CTA
- AUTH-010 Lock geçince kullanıcı tekrar giriş → failedLoginAttempts=0 reset, consecutiveLockCount korunur
- AUTH-011 3 art arda lock (consecutiveLockCount=3) → lockedUntil=NOW+24 SAAT, lockedReason='BRUTE_FORCE_24H', acil email + 🚨 Telegram alert
- AUTH-012 Lock aktif iken /forgot-password çalışır → şifre sıfırlama lock'u bypass eder (kullanıcı anında giriş yapabilir)
- AUTH-013 2FA enabled hesap → şifre doğru sonrası 2FA input ekranı
- AUTH-014 Yanlış TOTP kodu → "2FA kodu hatalı" + failedLoginAttempts ETKİLENMEZ (TOTP failure sayılmaz)
- AUTH-015 Recovery code kullanım → usedAt set, tekrar kullanılamaz
- AUTH-016 Email doğrulanmamış 8. gün → /verify-email redirect (7 gün grace bitti)
- AUTH-017 Süperadmin Toolbox "Kilidi Aç" → failedLoginAttempts=0, consecutiveLockCount=0, lockedUntil=NULL + audit + Telegram tenant'a bildirim

### Register (AUTH-018..027)
- AUTH-018 Geçerli form + Turnstile + 2 checkbox → users + companies INSERT + email gönder
- AUTH-019 Zayıf şifre (HIBP) → "Bu şifre veri sızıntılarında bulundu"
- AUTH-020 Email zaten kayıtlı → "Bu e-posta zaten kayıtlı"
- AUTH-021 KVKK checkbox işaretlenmemiş → submit disabled
- AUTH-022 Frankfurt veri lokasyonu açık rıza yok → submit disabled
- AUTH-023 Turnstile fail → 403 "Bot koruması doğrulanamadı"
- AUTH-024 Aynı IP'den 4. register denemesi → 429
- AUTH-025 Email DNS MX yok → "Geçerli bir e-posta gir"
- AUTH-026 Gmail "+" alias çakışmaz (`ahmet+mavi` ve `ahmet+sari` ayrı tenant)
- AUTH-027 Register sonrası JWT set + verify-email sayfası redirect

### Email Verification (AUTH-028..032)
- AUTH-028 Geçerli token tıklama → emailVerified=NOW + welcome email
- AUTH-029 Süresi dolmuş token → "Bağlantı geçersiz, yeniden gönder"
- AUTH-030 Resend cooldown 60 sn aktif (frontend countdown)
- AUTH-031 24 saatte 5+ resend → 429
- AUTH-032 7 gün doğrulanmamış → lockout (pg_cron job)

### Forgot Password (AUTH-033..042)
- AUTH-033 Kayıtlı email → token üret + email gönder + audit log
- AUTH-034 Kayıtsız email → aynı generic mesaj (enumeration koruma)
- AUTH-035 Turnstile zorunlu — fail → 403
- AUTH-036 Geçerli reset token → /reset-password formu
- AUTH-037 Süresi dolmuş reset token → "Bağlantı geçersiz"
- AUTH-038 Yeni şifre HIBP fail → reddedildi
- AUTH-039 Yeni şifre son 3 ile aynı → "Son 3 şifrenden farklı seç"
- AUTH-040 Reset başarılı → tüm session invalidate + email uyarı + /login redirect + failedLoginAttempts=0 + consecutiveLockCount=0 + lockedUntil=NULL
- AUTH-041 Aynı IP'den 4. forgot-password denemesi/saat → 429
- AUTH-042 Tek kullanımlık — 2. tıklama → token NULL, "Bağlantı geçersiz"

### 2FA (AUTH-043..049)
- AUTH-043 QR kod tara + 6 haneli kod → recovery codes adımı
- AUTH-044 Yanlış TOTP setup → "Kod hatalı, tekrar dene"
- AUTH-045 Recovery codes ekranı 8 kod gösterilir + hash DB'ye yazılır
- AUTH-046 "Kaydettim" checkbox işaretlenmeden enable → disabled
- AUTH-047 2FA kapatma şifre re-auth + email bildirim
- AUTH-048 8 recovery code'un tümü kullanıldı → kullanıcıya banner uyarı
- AUTH-049 Süperadmin Toolbox "2FA Reset" → twoFa* alanlar NULL + audit + Telegram

### Email Change (AUTH-050..055)
- AUTH-050 Şifre + Turnstile + yeni email → pendingEmail set, 2 email gönder
- AUTH-051 Yeni email tıklama → email=newEmail, audit
- AUTH-052 Eski email "iptal et" → pendingEmail NULL, audit + süperadmin alert
- AUTH-053 24 saat içinde doğrulanmadı → pg_cron temizler
- AUTH-054 Yeni email başka tenant'ta → "Zaten kayıtlı" (önce check)
- AUTH-055 Aynı anda 2 değişim isteği → ikincisi öncekini override eder

### Onboarding (AUTH-056..059)
- AUTH-056 Adım 1 şube ekle → branches INSERT, audit, Adım 2'ye
- AUTH-057 Adım 2 ürün ekle → products + variant + initial stock_movement, audit, Adım 3'e
- AUTH-058 Adım 3 vitrin profili "Yayınla" → storefrontStatus='approved' (AI moderation queue), audit, /dashboard
- AUTH-059 "Sonra hallederim" → storefrontStatus='disabled', /dashboard

**Toplam: 59 AUTH-* test senaryosu** (2026-05-15 sıkı brute-force policy ile 52 → 59 arttı)

---

## 14. İlgili Doc'lar

- `EKRAN-AYARLAR.md §2.5` — Şifre/2FA **policy** referansı (akış burada, policy detay orada)
- `EKRAN-KULLANICILAR.md §4` — Davet hibrit akışı (email + link iki yöntem)
- `DATABASE-SCHEMA.md §3.1` — users tablo field'ları (password reset, email verification, pending email, lockout)
- `DEPLOYMENT.md §2.3` — Frankfurt region + KVKK 3 katman uyum
- `TECH-STACK.md §3.10` — Cloudflare Turnstile servis detayı
- `PAYMENT-INTEGRATION.md §8.2` — Sub-processor listesi (Turnstile ek değil, CF zaten var)
- `SPRINT-PLAN.md §5` — Sprint 2 implementation (auth + onboarding + 2FA + email verify + forgot password)
- `UI-MOCKUP-PLAN.md §5.5` — auth.html mockup brief

---

## 15. Sıradaki

✅ Bu doküman (EKRAN-AUTH.md — 2026-05-15)
⏭ `preview/auth.html` mockup (Sprint 2 öncesi — UI-MOCKUP-PLAN sırasıyla)
⏭ Sprint 2 implementation (~5 iş günü — auth + onboarding + 2FA + email verify + forgot password)
⏭ Aydınlatma metni `/legal/aydinlatma` — Sprint 14 (PetStockPro şirket kuruluş sonrası gerçek bilgilerle)

---

*Son güncelleme: 2026-05-15. Auth akışlarının tek toplu doc'u — Sprint 2 mockup ve implementation için tek source.*
