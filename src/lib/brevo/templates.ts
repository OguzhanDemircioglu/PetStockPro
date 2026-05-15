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
