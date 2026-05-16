/**
 * Email Template Builders
 *
 * Brevo'ya gönderilen HTML email içerikleri.
 * Türkçe metinler, PetStockPro marka renkleri inline CSS ile
 * (email client'lar external CSS desteklemiyor).
 *
 * Template pattern: pure fn(input) → HTML string. Test edilebilir.
 */

const BRAND_CAT = '#d44a14';
const BRAND_CART = '#1a5588';
const BRAND_INK = '#1a2530';
const BRAND_BG = '#fafaf7';

/**
 * Ortak email shell (header + footer)
 */
function emailShell(content: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><title>PetStockPro</title></head>
<body style="margin:0;padding:0;font-family:Verdana,Geneva,Tahoma,sans-serif;background:${BRAND_BG};color:${BRAND_INK};">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND_BG};padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" border="0" width="560" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(20,40,55,.08);">
        <tr><td style="background:linear-gradient(135deg,${BRAND_CAT} 0%,#ed6a2c 100%);padding:24px 32px;text-align:center;">
          <h1 style="margin:0;font-size:24px;color:#fff;letter-spacing:-.5px;">PetStockPro</h1>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,.85);text-transform:uppercase;letter-spacing:.5px;font-weight:bold;">
            Pet shop yönetim platformu
          </p>
        </td></tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr><td style="background:${BRAND_BG};padding:20px 32px;font-size:11px;color:#94a0b0;text-align:center;border-top:1px solid #ecf0f5;">
          © 2026 PetStockPro · Cloudflare Workers altyapısı · KVKK uyumlu<br>
          Bu e-posta otomatik gönderildi, yanıtlama.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export interface VerifyEmailTemplateInput {
  userName: string | null;
  verifyUrl: string; // https://petstockpro.com/verify-email/[token]
  expiresInHours: number;
}

export interface VerifyEmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export function buildVerifyEmailTemplate(input: VerifyEmailTemplateInput): VerifyEmailTemplate {
  const greeting = input.userName ? `Merhaba ${input.userName},` : 'Merhaba,';

  const html = emailShell(`
    <h2 style="margin:0 0 16px;font-size:22px;color:${BRAND_CART};letter-spacing:-.3px;">
      E-posta adresini doğrula
    </h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
      PetStockPro'ya hoş geldin. Hesabını aktive etmek için aşağıdaki butona tıkla:
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:8px 0 24px;">
      <a href="${input.verifyUrl}" style="display:inline-block;background:${BRAND_CAT};color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 8px 20px rgba(212,74,20,.32);">
        E-posta adresini doğrula →
      </a>
    </td></tr></table>
    <p style="margin:0 0 8px;font-size:12px;color:#5f6b7c;line-height:1.5;">
      Bu link <strong>${input.expiresInHours} saat</strong> geçerli. Süre dolarsa giriş ekranında "Doğrulama linki tekrar gönder" diyebilirsin.
    </p>
    <p style="margin:24px 0 0;font-size:11px;color:#94a0b0;line-height:1.5;">
      Bağlantı çalışmazsa şunu tarayıcıya yapıştır:<br>
      <a href="${input.verifyUrl}" style="color:${BRAND_CART};word-break:break-all;">${input.verifyUrl}</a>
    </p>
    <p style="margin:16px 0 0;font-size:11px;color:#94a0b0;">
      Bu hesabı sen oluşturmadıysan bu e-postayı yok say — hesap 7 gün doğrulanmazsa otomatik kilitlenir.
    </p>
  `);

  const text = `${greeting}

PetStockPro'ya hoş geldin. Hesabını aktive etmek için aşağıdaki linke tıkla:

${input.verifyUrl}

Bu link ${input.expiresInHours} saat geçerli. Süre dolarsa giriş ekranında "Doğrulama linki tekrar gönder" diyebilirsin.

Bu hesabı sen oluşturmadıysan bu e-postayı yok say — hesap 7 gün doğrulanmazsa otomatik kilitlenir.

—
© 2026 PetStockPro · KVKK uyumlu`;

  return {
    subject: 'PetStockPro e-posta doğrulama',
    htmlContent: html,
    textContent: text,
  };
}

export interface ResetPasswordTemplateInput {
  userName: string | null;
  resetUrl: string;
  expiresInMinutes: number;
}

export function buildResetPasswordTemplate(input: ResetPasswordTemplateInput): VerifyEmailTemplate {
  const greeting = input.userName ? `Merhaba ${input.userName},` : 'Merhaba,';

  const html = emailShell(`
    <h2 style="margin:0 0 16px;font-size:22px;color:${BRAND_CART};letter-spacing:-.3px;">
      Şifreni sıfırla
    </h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
      Şifre sıfırlama talebinde bulundun. Yeni şifre belirlemek için butona tıkla:
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:8px 0 24px;">
      <a href="${input.resetUrl}" style="display:inline-block;background:${BRAND_CAT};color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 8px 20px rgba(212,74,20,.32);">
        Yeni şifre belirle →
      </a>
    </td></tr></table>
    <p style="margin:0 0 8px;font-size:12px;color:#5f6b7c;line-height:1.5;">
      Bu link <strong>${input.expiresInMinutes} dakika</strong> geçerli ve <strong>sadece bir kez</strong> kullanılabilir.
      Şifreni sıfırladığında tüm açık oturumların kapanır.
    </p>
    <p style="margin:16px 0 0;font-size:11px;color:#94a0b0;line-height:1.5;">
      Bu isteği sen yapmadıysan e-postayı yok say. Hesabın güvende —
      şifre değişmez. Ama yine de şifre yöneticini güncellemen önerilir.
    </p>
  `);

  const text = `${greeting}

Şifre sıfırlama talebinde bulundun. Yeni şifre belirlemek için aşağıdaki linke tıkla:

${input.resetUrl}

Bu link ${input.expiresInMinutes} dakika geçerli ve sadece bir kez kullanılabilir.

Bu isteği sen yapmadıysan e-postayı yok say.

—
© 2026 PetStockPro`;

  return {
    subject: 'PetStockPro şifre sıfırlama',
    htmlContent: html,
    textContent: text,
  };
}

export interface PasswordChangedTemplateInput {
  userName: string | null;
  changedAt: Date;
  ipAddress?: string | null;
  supportUrl?: string;
}

/**
 * Şifre değiştirildi bilgi/uyarı email'i (Sprint 2.4).
 *
 * EKRAN-AUTH §5.4: Reset başarılı sonrası kullanıcıya gönderilir.
 * "Sen değiştirdiysen tamam, sen değiştirmediysen destek" — saldırı tespit yolu.
 */
export function buildPasswordChangedTemplate(input: PasswordChangedTemplateInput): VerifyEmailTemplate {
  const greeting = input.userName ? `Merhaba ${input.userName},` : 'Merhaba,';
  const changedAtTr = input.changedAt.toLocaleString('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  });
  const supportUrl = input.supportUrl ?? 'mailto:destek@petstockpro.com';

  const html = emailShell(`
    <h2 style="margin:0 0 16px;font-size:22px;color:${BRAND_CART};letter-spacing:-.3px;">
      Şifren değiştirildi
    </h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      PetStockPro hesabının şifresi <strong>${changedAtTr}</strong> tarihinde
      değiştirildi. Tüm açık oturumların kapatıldı, yeni şifreyle tekrar giriş
      yapman gerekiyor.
    </p>
    ${input.ipAddress ? `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background:${BRAND_BG};border-radius:8px;">
      <tr><td style="padding:12px 16px;font-size:12px;color:#5f6b7c;">
        <strong style="color:${BRAND_INK};">İşlem bilgileri</strong><br>
        IP: ${input.ipAddress}<br>
        Zaman: ${changedAtTr}
      </td></tr>
    </table>
    ` : ''}
    <div style="border-left:4px solid ${BRAND_CAT};padding:12px 16px;background:#fff5ef;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <strong style="display:block;font-size:13px;color:${BRAND_CART};margin-bottom:6px;">
        ⚠ Bu işlemi sen yapmadıysan
      </strong>
      <span style="font-size:13px;color:#5f6b7c;line-height:1.6;">
        Birisi hesabına erişmiş olabilir. Hemen
        <a href="${supportUrl}" style="color:${BRAND_CART};font-weight:bold;">destek ekibine ulaş</a>
        ve hesabını kurtarmak için bizimle iletişime geç.
      </span>
    </div>
    <p style="margin:16px 0 0;font-size:11px;color:#94a0b0;line-height:1.5;">
      Bu otomatik bilgilendirme mesajıdır. Hesap güvenliği için her şifre
      değişikliğinde gönderilir.
    </p>
  `);

  const ipLine = input.ipAddress ? `\nIP: ${input.ipAddress}\n` : '\n';
  const text = `${greeting}

PetStockPro hesabının şifresi ${changedAtTr} tarihinde değiştirildi.
Tüm açık oturumların kapatıldı, yeni şifreyle tekrar giriş yapman gerekiyor.
${ipLine}
Bu işlemi sen yapmadıysan hemen destek ekibine ulaş: ${supportUrl}

—
© 2026 PetStockPro`;

  return {
    subject: 'PetStockPro · Şifren değiştirildi',
    htmlContent: html,
    textContent: text,
  };
}

// ─────────────────────────────────────────────────────────────────
// Sprint 2.7 — Account Locked (brute-force 5 fail + 24h kalıcı)
// ─────────────────────────────────────────────────────────────────

export type AccountLockedReason = 'BRUTE_FORCE_1H' | 'BRUTE_FORCE_24H';

export interface AccountLockedTemplateInput {
  userName: string | null;
  reason: AccountLockedReason;
  lockedUntil: Date;
  ipAddress?: string | null;
  resetPasswordUrl: string;
  supportEmail?: string;
}

/**
 * Hesap kilitli bildirimi (Sprint 2.7).
 *
 * 1H varyant: standart brute-force lock — kullanıcıyı uyarır, Şifremi Unuttum CTA.
 * 24H varyant: art arda 3 lock = ciddi saldırı şüphesi, acil tonlu uyarı.
 *
 * EKRAN-AUTH §10 — kullanıcı kendi yapmadıysa bile sinyal alır.
 */
export function buildAccountLockedTemplate(input: AccountLockedTemplateInput): VerifyEmailTemplate {
  const greeting = input.userName ? `Merhaba ${input.userName},` : 'Merhaba,';
  const lockedUntilTr = input.lockedUntil.toLocaleString('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  });
  const supportEmail = input.supportEmail ?? 'destek@petstockpro.com';
  const isPermanent = input.reason === 'BRUTE_FORCE_24H';
  const durationLabel = isPermanent ? '24 SAAT' : '1 saat';

  const intro = isPermanent
    ? `⚠ <strong>Hesabına 3 kez art arda yanlış giriş denendi</strong>. Bu ciddi bir saldırı sinyali olduğu için hesabın güvenlik nedeniyle <strong>${durationLabel} kilitlendi</strong>. Şifreni hemen değiştir.`
    : `Hesabına 5 başarısız giriş denendi. Güvenlik nedeniyle hesabın <strong>${durationLabel} kilitlendi</strong>. Kilit ${lockedUntilTr} tarihinde otomatik açılır.`;

  const headlineColor = isPermanent ? BRAND_CAT : BRAND_CART;
  const headline = isPermanent
    ? '🔒 Hesabın 24 saat kilitlendi — saldırı şüphesi'
    : '🔒 Hesabın 1 saat kilitlendi';

  const html = emailShell(`
    <h2 style="margin:0 0 16px;font-size:22px;color:${headlineColor};letter-spacing:-.3px;">
      ${headline}
    </h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">${intro}</p>

    ${input.ipAddress ? `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background:${BRAND_BG};border-radius:8px;">
      <tr><td style="padding:12px 16px;font-size:12px;color:#5f6b7c;">
        <strong style="color:${BRAND_INK};">Saldırı detayı</strong><br>
        IP: ${input.ipAddress}<br>
        Tahmini açılış: ${lockedUntilTr}
      </td></tr>
    </table>
    ` : ''}

    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:8px 0 24px;">
      <a href="${input.resetPasswordUrl}" style="display:inline-block;background:${BRAND_CAT};color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 8px 20px rgba(212,74,20,.32);">
        🔑 Şifremi sıfırla (kilidi bypass eder)
      </a>
    </td></tr></table>

    <p style="margin:0 0 8px;font-size:12px;color:#5f6b7c;line-height:1.5;">
      <strong>Şifre sıfırlama lock'u atlatır:</strong> yeni şifre belirleyince anında giriş yapabilirsin.
    </p>

    <div style="border-left:4px solid ${BRAND_CAT};padding:12px 16px;background:#fff5ef;border-radius:0 8px 8px 0;margin:24px 0 0;">
      <strong style="display:block;font-size:13px;color:${BRAND_CART};margin-bottom:6px;">
        Sen denemiyorsan
      </strong>
      <span style="font-size:13px;color:#5f6b7c;line-height:1.6;">
        Birisi senin hesabına erişmeye çalışıyor olabilir. Şifreni hemen değiştir +
        <a href="mailto:${supportEmail}" style="color:${BRAND_CART};font-weight:bold;">destek ekibine ulaş</a>.
      </span>
    </div>
  `);

  const text = `${greeting}

${isPermanent ? '⚠ Hesabına 3 kez art arda yanlış giriş denendi. 24 SAAT kilitlendi.' : `Hesabın güvenlik nedeniyle ${durationLabel} kilitlendi (${lockedUntilTr}'de açılır).`}

${input.ipAddress ? `IP: ${input.ipAddress}\n` : ''}
Şifreni sıfırla (lock bypass): ${input.resetPasswordUrl}

Sen denemiyorsan destek: ${supportEmail}

—
© 2026 PetStockPro`;

  return {
    subject: isPermanent
      ? 'PetStockPro · 🔒🔒 Hesabın 24 saat kilitlendi (saldırı şüphesi)'
      : 'PetStockPro · 🔒 Hesabın 1 saat kilitlendi',
    htmlContent: html,
    textContent: text,
  };
}

// ─────────────────────────────────────────────────────────────────
// Sprint 2.9 — Email Change (3 template: new-confirm + old-notify + completed)
// ─────────────────────────────────────────────────────────────────

export interface EmailChangeRequestNewInput {
  verifyUrl: string;
  newEmail: string;
  currentEmail: string;
  expiresInHours: number;
}

/** YENİ email'e gönderilen "doğrula" mesajı. */
export function buildEmailChangeRequestNewTemplate(
  input: EmailChangeRequestNewInput,
): VerifyEmailTemplate {
  const html = emailShell(`
    <h2 style="margin:0 0 16px;font-size:22px;color:${BRAND_CART};letter-spacing:-.3px;">
      Yeni e-postanı doğrula
    </h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Merhaba,</p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
      <strong>${input.currentEmail}</strong> adresine ait PetStockPro hesabının
      e-postasını <strong>${input.newEmail}</strong> olarak değiştirme isteği
      başlatıldı. Bu adresin gerçekten sana ait olduğunu doğrulamak için butona tıkla:
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:8px 0 24px;">
      <a href="${input.verifyUrl}" style="display:inline-block;background:${BRAND_CAT};color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 8px 20px rgba(212,74,20,.32);">
        ✓ Yeni e-postamı doğrula
      </a>
    </td></tr></table>
    <p style="margin:0 0 8px;font-size:12px;color:#5f6b7c;line-height:1.5;">
      Bu link <strong>${input.expiresInHours} saat</strong> geçerli. Sen başlatmadıysan
      bu e-postayı yok say — değişiklik tamamlanmaz.
    </p>
  `);

  return {
    subject: 'PetStockPro · Yeni e-postanı doğrula',
    htmlContent: html,
    textContent: `Yeni e-postanı doğrula\n\n${input.currentEmail} adresine ait PetStockPro hesabının e-postası ${input.newEmail} olarak değiştirilmek isteniyor.\n\nDoğrula: ${input.verifyUrl}\n\n${input.expiresInHours} saat geçerli. Sen başlatmadıysan bu e-postayı yok say.\n\n— © 2026 PetStockPro`,
  };
}

export interface EmailChangeNotifyOldInput {
  cancelUrl: string;
  newEmail: string;
  currentEmail: string;
}

/** ESKİ email'e gönderilen "değişiklik isteği başlatıldı — iptal et" mesajı. */
export function buildEmailChangeNotifyOldTemplate(
  input: EmailChangeNotifyOldInput,
): VerifyEmailTemplate {
  const html = emailShell(`
    <h2 style="margin:0 0 16px;font-size:22px;color:${BRAND_CART};letter-spacing:-.3px;">
      E-posta değişikliği isteği
    </h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Merhaba,</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      PetStockPro hesabının e-postası <strong>${input.currentEmail}</strong>
      adresinden <strong>${input.newEmail}</strong> adresine taşınmak isteniyor.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
      Bunu sen başlattıysan herhangi bir şey yapmana gerek yok. Yeni e-postaya
      gönderilen linkten onaylanınca değişiklik tamamlanır.
    </p>
    <div style="border-left:4px solid ${BRAND_CAT};padding:12px 16px;background:#fff5ef;border-radius:0 8px 8px 0;margin:0 0 24px;">
      <strong style="display:block;font-size:13px;color:${BRAND_CART};margin-bottom:6px;">
        ⚠ Bunu sen başlatmadıysan
      </strong>
      <span style="font-size:13px;color:#5f6b7c;line-height:1.6;">
        Birisi hesabına erişmiş olabilir. Aşağıdaki butona tıklayarak değişikliği iptal et
        ve hemen şifreni değiştir.
      </span>
    </div>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:8px 0 24px;">
      <a href="${input.cancelUrl}" style="display:inline-block;background:#d63939;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;">
        🚫 Değişikliği İptal Et
      </a>
    </td></tr></table>
    <p style="margin:0 0 8px;font-size:12px;color:#5f6b7c;line-height:1.5;">
      Bu otomatik bilgilendirme mesajıdır. Süperadmin'e de bildirim gönderilir.
    </p>
  `);

  return {
    subject: 'PetStockPro · ⚠ E-posta değişikliği isteği',
    htmlContent: html,
    textContent: `E-posta değişikliği isteği\n\nPetStockPro hesabının e-postası ${input.currentEmail} → ${input.newEmail} olarak değiştirilmek isteniyor.\n\nBunu sen başlattıysan bir şey yapmana gerek yok. Sen başlatmadıysan İPTAL ET:\n${input.cancelUrl}\n\n— © 2026 PetStockPro`,
  };
}

export interface EmailChangedFinalInput {
  oldEmail: string;
  newEmail: string;
}

/** Email değişikliği tamamlandı — eski email'e final bilgi. */
export function buildEmailChangedFinalTemplate(input: EmailChangedFinalInput): VerifyEmailTemplate {
  const html = emailShell(`
    <h2 style="margin:0 0 16px;font-size:22px;color:${BRAND_CART};letter-spacing:-.3px;">
      ✓ E-posta değişikliği tamamlandı
    </h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Merhaba,</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      PetStockPro hesabının e-postası başarıyla değiştirildi:
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background:${BRAND_BG};border-radius:8px;">
      <tr><td style="padding:12px 16px;font-size:13px;color:#5f6b7c;line-height:1.8;">
        <strong style="color:${BRAND_INK};">Eski:</strong> ${input.oldEmail}<br>
        <strong style="color:${BRAND_INK};">Yeni:</strong> ${input.newEmail}
      </td></tr>
    </table>
    <p style="margin:0 0 8px;font-size:12px;color:#5f6b7c;line-height:1.5;">
      Bundan sonra giriş için yeni e-postanı kullan. Sen yapmadıysan
      <a href="mailto:destek@petstockpro.com" style="color:${BRAND_CART};font-weight:bold;">destek</a>
      ile iletişime geç.
    </p>
  `);

  return {
    subject: 'PetStockPro · ✓ E-posta değiştirildi',
    htmlContent: html,
    textContent: `E-posta değişikliği tamamlandı\n\nEski: ${input.oldEmail}\nYeni: ${input.newEmail}\n\nGiriş için yeni e-postanı kullan. Sen yapmadıysan destek@petstockpro.com\n\n— © 2026 PetStockPro`,
  };
}

// ══════════════════════════════════════════════════════════════
// Sprint 9 — User invite (email yöntemi)
// ══════════════════════════════════════════════════════════════

export interface UserInviteTemplateInput {
  inviteeName?: string | null;
  inviterName: string;
  companyName: string;
  roleLabel: string;
  acceptUrl: string;
  expiresInDays: number;
}

export function buildUserInviteTemplate(input: UserInviteTemplateInput): VerifyEmailTemplate {
  const greeting = input.inviteeName ? `Merhaba ${input.inviteeName},` : 'Merhaba,';
  const html = emailShell(`
    <h2 style="margin:0 0 16px;font-size:22px;color:${BRAND_CART};letter-spacing:-.3px;">
      Ekibe davet edildin
    </h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      <strong>${input.inviterName}</strong>, <strong>${input.companyName}</strong>
      PetStockPro ekibine seni <strong>${input.roleLabel}</strong> rolüyle davet etti.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
      Davete katılmak ve şifreni belirlemek için aşağıdaki butona tıkla:
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:8px 0 24px;">
      <a href="${input.acceptUrl}" style="display:inline-block;background:${BRAND_CAT};color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:14px;box-shadow:0 8px 20px rgba(212,74,20,.32);">
        Daveti kabul et →
      </a>
    </td></tr></table>
    <p style="margin:0 0 8px;font-size:12px;color:#5f6b7c;line-height:1.5;">
      Bu link <strong>${input.expiresInDays} gün</strong> geçerli ve <strong>sadece bir kez</strong> kullanılabilir.
      Davet süresi dolarsa <strong>${input.inviterName}</strong> tekrar davet gönderebilir.
    </p>
    <p style="margin:16px 0 0;font-size:11px;color:#94a0b0;line-height:1.5;">
      Bu daveti sen istemediysen ya da ${input.inviterName} ile bağın yoksa
      e-postayı yok say — hesap oluşturulmaz.
    </p>
  `);

  const text = `${greeting}

${input.inviterName}, ${input.companyName} PetStockPro ekibine seni ${input.roleLabel} rolüyle davet etti.

Davete katılmak ve şifreni belirlemek için:
${input.acceptUrl}

Bu link ${input.expiresInDays} gün geçerli, sadece bir kez kullanılabilir.

—
© 2026 PetStockPro`;

  return {
    subject: `PetStockPro · ${input.companyName} ekibi seni davet etti`,
    htmlContent: html,
    textContent: text,
  };
}
