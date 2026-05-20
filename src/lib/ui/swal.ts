'use client';

/**
 * SweetAlert2 wrapper — TR locale + PetStockPro tema (cat-soft turuncu accent).
 *
 * Tüm modaller buradan çağrılır. Form üzerinde `role="alert"` div banner'ları
 * yerine bu helper kullanılmalı (2026-05-20 kullanıcı kararı).
 *
 * Pattern:
 *   swalSuccess('Başarılı', 'X kayıt eklendi')
 *   swalError('Hata', '...')
 *   await swalConfirm('Sil?', 'Geri alınamaz', 'Sil', 'İptal') → true/false
 *   await swalInfoToast('Kaydedildi')   // 3sn top-right toast
 */

import Swal, { type SweetAlertResult } from 'sweetalert2';

const BASE = {
  confirmButtonColor: '#D44A14', // cat (turuncu)
  cancelButtonColor: '#6B7280', // gray-500
  reverseButtons: true,
  buttonsStyling: true,
};

export function swalSuccess(title: string, text?: string): Promise<SweetAlertResult> {
  return Swal.fire({
    ...BASE,
    icon: 'success',
    title,
    text,
    confirmButtonText: 'Tamam',
  });
}

export function swalError(title: string, text?: string): Promise<SweetAlertResult> {
  return Swal.fire({
    ...BASE,
    icon: 'error',
    title,
    text,
    confirmButtonText: 'Tamam',
  });
}

export function swalWarning(title: string, text?: string): Promise<SweetAlertResult> {
  return Swal.fire({
    ...BASE,
    icon: 'warning',
    title,
    text,
    confirmButtonText: 'Tamam',
  });
}

export function swalInfo(title: string, text?: string): Promise<SweetAlertResult> {
  return Swal.fire({
    ...BASE,
    icon: 'info',
    title,
    text,
    confirmButtonText: 'Tamam',
  });
}

export async function swalConfirm(
  title: string,
  text: string,
  confirmText = 'Evet',
  cancelText = 'İptal',
  icon: 'warning' | 'question' = 'warning',
): Promise<boolean> {
  const r = await Swal.fire({
    ...BASE,
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
  });
  return r.isConfirmed;
}

/**
 * Sağ üst köşede otomatik kapanan toast.
 *
 * Form hataları için default — modal yerine bu kullanılır (2026-05-20 kullanıcı
 * tercihi: form üstü banner YOK, ortada modal YOK, sağ üstte kaybolur).
 *
 * @param title — başlık (zorunlu)
 * @param text  — alt satır detay (opsiyonel)
 * @param icon  — success / info / warning / error (default error)
 * @param duration — ms (default 4000 — error'a 4 sn, success 3 sn)
 */
export function swalToast(
  title: string,
  text?: string,
  icon: 'success' | 'info' | 'warning' | 'error' = 'success',
  duration?: number,
): Promise<SweetAlertResult> {
  const ms = duration ?? (icon === 'error' ? 4000 : 3000);
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    text,
    showConfirmButton: false,
    timer: ms,
    timerProgressBar: true,
    didOpen: (el) => {
      el.addEventListener('mouseenter', Swal.stopTimer);
      el.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });
}

/**
 * HTML içerikli modal (örn. Excel import özeti, scrollable hata listesi).
 *
 * - confirmText="" verirsen yalnız "İptal" çıkar (info-only)
 * - actions: ek butonlar ("Sadece geçerlileri yükle" gibi)
 */
export interface SwalHtmlOpts {
  title: string;
  html: string;
  icon?: 'success' | 'info' | 'warning' | 'error' | 'question';
  confirmText?: string;
  cancelText?: string;
  width?: number | string;
}

export async function swalHtml(opts: SwalHtmlOpts): Promise<boolean> {
  const r = await Swal.fire({
    ...BASE,
    icon: opts.icon,
    title: opts.title,
    html: opts.html,
    showCancelButton: opts.cancelText !== undefined,
    confirmButtonText: opts.confirmText ?? 'Tamam',
    cancelButtonText: opts.cancelText ?? 'İptal',
    width: opts.width ?? 600,
  });
  return r.isConfirmed;
}
