import { describe, it, expect } from 'vitest';
import {
  buildVerifyEmailTemplate,
  buildResetPasswordTemplate,
  buildPasswordChangedTemplate,
  buildEmailChangeRequestNewTemplate,
  buildEmailChangeNotifyOldTemplate,
  buildEmailChangedFinalTemplate,
} from './templates';

describe('buildVerifyEmailTemplate', () => {
  const sampleInput = {
    userName: 'Mehmet',
    verifyUrl: 'https://petstockpro.com/verify-email/abc123',
    expiresInHours: 24,
  };

  it('subject Türkçe', () => {
    const t = buildVerifyEmailTemplate(sampleInput);
    expect(t.subject).toBe('PetStockPro e-posta doğrulama');
  });

  it('HTML verify URL içerir', () => {
    const t = buildVerifyEmailTemplate(sampleInput);
    expect(t.htmlContent).toContain('https://petstockpro.com/verify-email/abc123');
  });

  it('HTML kullanıcı adıyla kişiselleşir', () => {
    const t = buildVerifyEmailTemplate(sampleInput);
    expect(t.htmlContent).toContain('Merhaba Mehmet');
  });

  it('userName null ise generic "Merhaba,"', () => {
    const t = buildVerifyEmailTemplate({ ...sampleInput, userName: null });
    expect(t.htmlContent).toContain('Merhaba,');
    expect(t.htmlContent).not.toContain('Merhaba null');
  });

  it('expires saat metni içerir', () => {
    const t = buildVerifyEmailTemplate(sampleInput);
    expect(t.htmlContent).toContain('24 saat');
  });

  it('text fallback (plain) içerir verify URL', () => {
    const t = buildVerifyEmailTemplate(sampleInput);
    expect(t.textContent).toContain('https://petstockpro.com/verify-email/abc123');
    expect(t.textContent).toContain('24 saat');
  });

  it('HTML PetStockPro branding (logo+footer)', () => {
    const t = buildVerifyEmailTemplate(sampleInput);
    expect(t.htmlContent).toContain('PetStockPro');
    expect(t.htmlContent).toContain('KVKK uyumlu');
  });

  it('HTML inline CSS (email client uyumluluk)', () => {
    const t = buildVerifyEmailTemplate(sampleInput);
    // External stylesheet referansı yok
    expect(t.htmlContent).not.toContain('<link');
    // Style attribute mevcut
    expect(t.htmlContent).toContain('style=');
  });
});

describe('buildResetPasswordTemplate', () => {
  const sampleInput = {
    userName: 'Zeynep',
    resetUrl: 'https://petstockpro.com/reset-password/xyz456',
    expiresInMinutes: 30,
  };

  it('subject Türkçe', () => {
    const t = buildResetPasswordTemplate(sampleInput);
    expect(t.subject).toBe('PetStockPro şifre sıfırlama');
  });

  it('reset URL HTML içinde', () => {
    const t = buildResetPasswordTemplate(sampleInput);
    expect(t.htmlContent).toContain('https://petstockpro.com/reset-password/xyz456');
  });

  it('30 dakika expires uyarısı', () => {
    const t = buildResetPasswordTemplate(sampleInput);
    expect(t.htmlContent).toContain('30 dakika');
  });

  it('tek kullanımlık uyarısı', () => {
    const t = buildResetPasswordTemplate(sampleInput);
    expect(t.htmlContent).toContain('sadece bir kez');
  });

  it('açık oturum invalidation uyarısı', () => {
    const t = buildResetPasswordTemplate(sampleInput);
    expect(t.htmlContent).toContain('açık oturumların kapanır');
  });

  it('userName null ise generic', () => {
    const t = buildResetPasswordTemplate({ ...sampleInput, userName: null });
    expect(t.htmlContent).toContain('Merhaba,');
  });
});

describe('buildPasswordChangedTemplate', () => {
  const sampleInput = {
    userName: 'Ali',
    changedAt: new Date('2026-05-15T07:30:00Z'), // 10:30 Istanbul
    ipAddress: '203.0.113.42',
  };

  it('subject "şifren değiştirildi" mesajı', () => {
    const t = buildPasswordChangedTemplate(sampleInput);
    expect(t.subject).toBe('PetStockPro · Şifren değiştirildi');
  });

  it('Istanbul saatine göre tarih formatlanır', () => {
    const t = buildPasswordChangedTemplate(sampleInput);
    // tr-TR locale "Mayıs" + saat "10:30" (Europe/Istanbul UTC+3)
    expect(t.htmlContent).toMatch(/Mayıs/);
    expect(t.htmlContent).toContain('10:30');
  });

  it('IP adresi verildi ise HTML\'de bulunur', () => {
    const t = buildPasswordChangedTemplate(sampleInput);
    expect(t.htmlContent).toContain('203.0.113.42');
  });

  it('IP adresi yoksa İşlem bilgileri bloku render edilmez', () => {
    const t = buildPasswordChangedTemplate({ ...sampleInput, ipAddress: null });
    expect(t.htmlContent).not.toContain('İşlem bilgileri');
    expect(t.htmlContent).not.toContain('203.0.113');
  });

  it('"sen yapmadıysan" uyarı bölümü içerir', () => {
    const t = buildPasswordChangedTemplate(sampleInput);
    expect(t.htmlContent).toContain('sen yapmadıysan');
  });

  it('destek URL default mailto', () => {
    const t = buildPasswordChangedTemplate(sampleInput);
    expect(t.htmlContent).toContain('mailto:info@petstockpro.com');
  });

  it('userName null ise generic greeting', () => {
    const t = buildPasswordChangedTemplate({ ...sampleInput, userName: null });
    expect(t.htmlContent).toContain('Merhaba,');
    expect(t.htmlContent).not.toContain('Merhaba null');
  });

  it('text fallback IP ve uyarı içerir', () => {
    const t = buildPasswordChangedTemplate(sampleInput);
    expect(t.textContent).toContain('203.0.113.42');
    expect(t.textContent).toContain('info@petstockpro.com');
  });
});

describe('buildEmailChangeRequestNewTemplate', () => {
  const input = {
    verifyUrl: 'https://petstockpro.com/verify-email-change/abc',
    newEmail: 'new@ps.com',
    currentEmail: 'old@ps.com',
    expiresInHours: 24,
  };

  it('Subject "yeni e-postanı doğrula"', () => {
    const t = buildEmailChangeRequestNewTemplate(input);
    expect(t.subject).toMatch(/Yeni e-posta/);
  });

  it('HTML verify URL + 2 email + saat içerir', () => {
    const t = buildEmailChangeRequestNewTemplate(input);
    expect(t.htmlContent).toContain(input.verifyUrl);
    expect(t.htmlContent).toContain('new@ps.com');
    expect(t.htmlContent).toContain('old@ps.com');
    expect(t.htmlContent).toContain('24 saat');
  });
});

describe('buildEmailChangeNotifyOldTemplate', () => {
  const input = {
    cancelUrl: 'https://petstockpro.com/cancel-email-change/abc',
    newEmail: 'new@ps.com',
    currentEmail: 'old@ps.com',
  };

  it('Subject "E-posta" + isteği bilgisi', () => {
    const t = buildEmailChangeNotifyOldTemplate(input);
    expect(t.subject).toMatch(/E-posta/);
    expect(t.subject).toMatch(/⚠/);
  });

  it('İptal CTA + uyarı bloku', () => {
    const t = buildEmailChangeNotifyOldTemplate(input);
    expect(t.htmlContent).toContain(input.cancelUrl);
    expect(t.htmlContent).toContain('İptal Et');
    // "Bunu sen başlatmadıysan" uyarısı (Unicode-safe substring)
    expect(t.htmlContent.includes('Bunu sen ba')).toBe(true);
  });

  it('Eski + yeni email gösterilir', () => {
    const t = buildEmailChangeNotifyOldTemplate(input);
    expect(t.htmlContent).toContain('old@ps.com');
    expect(t.htmlContent).toContain('new@ps.com');
  });
});

describe('buildEmailChangedFinalTemplate', () => {
  it('Subject "değiştirildi"', () => {
    const t = buildEmailChangedFinalTemplate({ oldEmail: 'old@ps.com', newEmail: 'new@ps.com' });
    expect(t.subject).toContain('değiştirildi');
  });

  it('Eski + yeni email + destek bilgisi', () => {
    const t = buildEmailChangedFinalTemplate({ oldEmail: 'old@ps.com', newEmail: 'new@ps.com' });
    expect(t.htmlContent).toContain('old@ps.com');
    expect(t.htmlContent).toContain('new@ps.com');
    expect(t.htmlContent).toContain('info@petstockpro.com');
  });
});
