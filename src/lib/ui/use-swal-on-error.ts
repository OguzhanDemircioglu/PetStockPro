'use client';

import { useEffect, useRef } from 'react';
import { swalToast } from './swal';

/**
 * Form action state'i değiştiğinde, state.error varsa **sağ üstte toast** göster.
 *
 * 2026-05-20 kullanıcı kararı:
 *  - Form üstü `role="alert"` banner YOK
 *  - Ortada SWAL modal YOK
 *  - Sağ üstte 4 sn otomatik kapanan toast (hover ile pause)
 *  - Input-level kızartma (border-danger) KALIR — bağımsız field validation
 *
 * Pattern:
 *   const [state, formAction, pending] = useActionState(...);
 *   useSwalOnError(state);
 *
 * Aynı state referansını birden fazla render'da yakalamamak için ref ile track edilir.
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
        ? state.issues.slice(1).join(' · ')
        : undefined;
    void swalToast(state.error, detail, 'error');
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
    void swalToast(title, value, 'error');
  }, [value, title]);
}
