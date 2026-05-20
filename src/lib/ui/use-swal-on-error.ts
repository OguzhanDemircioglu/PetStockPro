'use client';

import { useEffect, useRef } from 'react';
import { swalError } from './swal';

/**
 * Form action state'i değiştiğinde, state.error varsa SWAL modal göster.
 *
 * Pattern (form üstü `role="alert"` banner'ı yerine — 2026-05-20 kullanıcı kararı):
 *
 *   const [state, formAction, pending] = useActionState(...);
 *   useSwalOnError(state);
 *
 * Aynı state referansını birden fazla render'da yakalamamak için ref ile track edilir.
 *
 * state.issues varsa (Zod multi-error) birinci elemandan sonrası detail olarak gösterilir.
 */
interface MinimalErrorState {
  error?: string | null;
  issues?: string[] | null;
}

export function useSwalOnError<T extends MinimalErrorState | null | undefined>(state: T) {
  const lastShown = useRef<unknown>(null);
  useEffect(() => {
    if (!state || !state.error) return;
    if (lastShown.current === state) return; // aynı state'i 2 kez gösterme
    lastShown.current = state;
    const detail =
      state.issues && state.issues.length > 1
        ? state.issues.slice(1).join('\n')
        : undefined;
    void swalError(state.error, detail);
  }, [state]);
}

/**
 * Tek bir error string field'ı izle (form action state dışı, useState ile tutulan).
 *
 * Pattern:
 *   const [imageError, setImageError] = useState<string | null>(null);
 *   useSwalOnErrorString(imageError);
 */
export function useSwalOnErrorString(value: string | null | undefined, title = 'Hata') {
  const lastShown = useRef<string | null>(null);
  useEffect(() => {
    if (!value) return;
    if (lastShown.current === value) return;
    lastShown.current = value;
    void swalError(title, value);
  }, [value, title]);
}
