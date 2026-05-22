'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props {
  src: string | null;
  alt: string;
  sizes?: string;
  /** Wrapper'a sığacak. Aspect ratio dış div ile yönetilir. */
  fill?: boolean;
}

/**
 * Vitrin ürün resmi — onError ile logo placeholder fallback.
 *
 * Supabase storage'da bazı image dosyaları corrupt (70 byte, placeholder
 * upload başarısız) → Image natW=0 ile yüklenir, kullanıcı siyah/boş kart
 * görür. Bu component fail durumunda PetStockPro logosunu placeholder
 * olarak gösterir.
 */
export function ProductImage({ src, alt, sizes, fill = true }: Props) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div className="grid h-full w-full place-items-center bg-white">
        <Image
          src="/logo.webp"
          alt=""
          width={88}
          height={88}
          className="h-20 w-20 object-contain opacity-90"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      className="object-cover"
      onError={() => setErrored(true)}
      onLoad={(e) => {
        // Corrupt image (200 OK ama 0x0 px) — onError fire etmez, onLoad'da yakala
        const img = e.currentTarget as HTMLImageElement;
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          setErrored(true);
        }
      }}
    />
  );
}
