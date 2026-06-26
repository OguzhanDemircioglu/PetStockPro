import Link from 'next/link';
import Image from 'next/image';

/**
 * LegalHeader — public yasal belge sayfalarının sade üst başlığı.
 *
 * Marketing header'ı (marketing/header.tsx) "Fiyatlar / Ücretsiz başla" CTA'lı
 * olduğu için yasal sayfalar "ayrı landing" gibi duruyordu. Bunun yerine sade
 * logo + Giriş linki: belge sayfası nötr görünür, pazarlama hissi vermez.
 */
export function LegalHeader() {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.webp"
            width={26}
            height={26}
            alt="PetStockPro"
            className="rounded-lg"
          />
          <span className="text-[15px] font-bold tracking-tight text-cart">
            PetStockPro
          </span>
        </Link>
        <Link
          href="/login"
          className="text-[13px] font-bold text-ink-2 hover:text-cat"
        >
          Giriş →
        </Link>
      </div>
    </header>
  );
}
