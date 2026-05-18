import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildVitrinPageMetadata } from './page-metadata';

describe('buildVitrinPageMetadata', () => {
  let originalSite: string | undefined;

  beforeEach(() => {
    originalSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://petstockpro.com';
  });
  afterEach(() => {
    if (originalSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSite;
  });

  it('minimum input — canonical + OG + Twitter Cards üretir', () => {
    const m = buildVitrinPageMetadata({
      title: 'Test Sayfa',
      description: 'Test açıklama',
      path: '/vitrin/test',
    });
    expect(m.title).toBe('Test Sayfa');
    expect(m.description).toBe('Test açıklama');
    expect(m.alternates?.canonical).toBe('https://petstockpro.com/vitrin/test');
    expect(m.openGraph?.url).toBe('https://petstockpro.com/vitrin/test');
    expect(m.openGraph?.title).toBe('Test Sayfa');
    expect(m.openGraph?.siteName).toBe('PetStockPro');
    expect(m.openGraph?.locale).toBe('tr_TR');
    // Twitter card
    expect(m.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Test Sayfa',
      description: 'Test açıklama',
    });
  });

  it('default OG image — /og-image.png absolute URL (1200×630)', () => {
    const m = buildVitrinPageMetadata({
      title: 'X',
      description: 'Y',
      path: '/vitrin/x',
    });
    const ogImages = m.openGraph?.images as Array<{
      url: string;
      width: number;
      height: number;
    }>;
    expect(ogImages?.[0]?.url).toBe('https://petstockpro.com/og-image.png');
    expect(ogImages?.[0]?.width).toBe(1200);
    expect(ogImages?.[0]?.height).toBe(630);
    const twImages = m.twitter?.images as string[];
    expect(twImages?.[0]).toBe('https://petstockpro.com/og-image.png');
  });

  it('custom imageUrl — OG + Twitter\'a aynısı set edilir', () => {
    const m = buildVitrinPageMetadata({
      title: 'X',
      description: 'Y',
      path: '/vitrin/x',
      imageUrl: 'https://cdn.example.com/img.jpg',
    });
    const ogImages = m.openGraph?.images as Array<{ url: string }>;
    expect(ogImages?.[0]?.url).toBe('https://cdn.example.com/img.jpg');
    const twImages = m.twitter?.images as string[];
    expect(twImages?.[0]).toBe('https://cdn.example.com/img.jpg');
  });

  it('ogType — default website, profile override edilebilir', () => {
    const defaultMeta = buildVitrinPageMetadata({
      title: 'X',
      description: 'Y',
      path: '/x',
    });
    expect((defaultMeta.openGraph as { type?: string })?.type).toBe('website');

    const profileMeta = buildVitrinPageMetadata({
      title: 'X',
      description: 'Y',
      path: '/x',
      ogType: 'profile',
    });
    expect((profileMeta.openGraph as { type?: string })?.type).toBe('profile');
  });

  it('robots — default index/follow true', () => {
    const m = buildVitrinPageMetadata({
      title: 'X',
      description: 'Y',
      path: '/x',
    });
    expect(m.robots).toEqual({ index: true, follow: true });
  });

  it('robots — index=false → noindex follow', () => {
    const m = buildVitrinPageMetadata({
      title: 'X',
      description: 'Y',
      path: '/x',
      index: false,
    });
    expect(m.robots).toEqual({ index: false, follow: true });
  });

  it('canonical path — leading slash zorunlu (sondaki trim getPublicBaseUrl\'de)', () => {
    const m = buildVitrinPageMetadata({
      title: 'X',
      description: 'Y',
      path: '/vitrin/magaza/test',
    });
    expect(m.alternates?.canonical).toBe(
      'https://petstockpro.com/vitrin/magaza/test',
    );
  });

  it('getPublicBaseUrl fallback — env yoksa localhost', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;
    const m = buildVitrinPageMetadata({
      title: 'X',
      description: 'Y',
      path: '/vitrin/x',
    });
    expect(m.alternates?.canonical).toBe('http://localhost:3000/vitrin/x');
  });
});
