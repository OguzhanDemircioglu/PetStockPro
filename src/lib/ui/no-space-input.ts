'use client';

import type { FormEvent } from 'react';

/**
 * Input'tan tüm boşlukları (space, tab, newline) anında temizler.
 *
 * E-posta (kullanıcı adı) ve şifre alanlarında boşluk girilmesini engeller.
 * `onChange` / `onInput` handler'ı olarak uncontrolled input'lara takılır —
 * yazma, yapıştırma, sürükle-bırak ve autofill dahil tüm girdi yollarını kapsar.
 *
 * İmleç konumu korunur: kullanıcı ortada bir yere boşluk yazsa bile imleç
 * doğru noktada kalır (sona zıplamaz).
 *
 * Kullanım:
 *   <input name="email" onChange={stripSpacesOnInput} ... />
 */
export function stripSpacesOnInput(e: FormEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  if (!/\s/.test(el.value)) return;

  const caret = el.selectionStart ?? el.value.length;
  const removedBeforeCaret = (el.value.slice(0, caret).match(/\s/g) ?? []).length;

  el.value = el.value.replace(/\s/g, '');

  const newCaret = caret - removedBeforeCaret;
  el.setSelectionRange(newCaret, newCaret);
}
