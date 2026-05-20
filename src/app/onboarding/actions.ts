'use server';

/**
 * Onboarding Server Actions — Sprint 2.6
 *
 * Wizard 3 adım (Sprint 2.6'da 2 + complete):
 *   1. branchAction → createFirstBranch
 *   2. storefrontAction → saveStorefront (opsiyonel)
 *   3. completeAction → completeOnboarding + redirect /
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { db } from '@/lib/db/client';
import {
  createFirstBranch,
  saveStorefront,
  completeOnboarding,
} from '@/lib/onboarding/actions';
import { createProduct } from '@/lib/catalog/products';
import { seedCatalogBrandsForCompany } from '@/lib/brands/seed-catalog';
import { writeAuditLogAsync } from '@/lib/audit/log';

export interface BranchState {
  ok: boolean;
  error: string | null;
  issues: string[];
  branchId: string | null;
  /** Catalog marka seed yapıldıysa ne kadar eklendi (UI'da banner). */
  brandsImported?: number | null;
}

export async function branchAction(
  _prevState: BranchState | null,
  formData: FormData,
): Promise<BranchState> {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login' as never);
  }

  const name = formData.get('name');
  const cityIdRaw = formData.get('cityId');
  const districtId = formData.get('districtId');
  const address = formData.get('address');
  const whatsappPhone = formData.get('whatsappPhone');

  const cityId = typeof cityIdRaw === 'string' ? parseInt(cityIdRaw, 10) : NaN;

  if (
    typeof name !== 'string' ||
    !Number.isFinite(cityId) ||
    typeof districtId !== 'string'
  ) {
    return { ok: false, error: 'Şube adı, il ve ilçe zorunlu', issues: [], branchId: null };
  }

  const result = await createFirstBranch(
    session.user.companyId,
    {
      name,
      cityId,
      districtId,
      address: typeof address === 'string' && address.length > 0 ? address : undefined,
      whatsappPhone:
        typeof whatsappPhone === 'string' && whatsappPhone.length > 0 ? whatsappPhone : undefined,
    },
    db,
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.issues[0] ?? 'Şube oluşturulamadı',
      issues: result.issues,
      branchId: null,
    };
  }

  // Opsiyonel: catalog markalarını içeri aktar (checkbox işaretli)
  let brandsImported: number | null = null;
  if (formData.get('importBrands') === 'true') {
    try {
      const seed = await seedCatalogBrandsForCompany(session.user.companyId, db);
      brandsImported = seed.inserted;
      if (seed.inserted > 0 && session.user.id) {
        writeAuditLogAsync(
          {
            companyId: session.user.companyId,
            userId: session.user.id,
            action: 'brands.catalog_seeded',
            entityType: 'company',
            entityId: session.user.companyId,
            afterState: {
              inserted: seed.inserted,
              skipped: seed.skipped,
              totalCandidates: seed.totalCandidates,
              source: 'onboarding_step1',
            },
          },
          db,
        );
      }
    } catch {
      // Brand seed başarısız olursa onboarding'i bloklamayız — sessiz ihlal,
      // kullanıcı şubeyi kaydetti, markaları sonra manuel ekleyebilir.
      brandsImported = 0;
    }
  }

  return {
    ok: true,
    error: null,
    issues: [],
    branchId: result.branchId,
    brandsImported,
  };
}

export interface StorefrontState {
  ok: boolean;
  error: string | null;
  slug: string | null;
  skipped: boolean;
}

export async function storefrontAction(
  _prevState: StorefrontState | null,
  formData: FormData,
): Promise<StorefrontState> {
  const session = await auth();
  if (!session?.user?.companyId) {
    redirect('/login' as never);
  }

  const skip = formData.get('skip') === 'true';
  if (skip) {
    // Vitrin atlandı — completeOnboarding + redirect
    await completeOnboarding(session.user.id, db);
    redirect('/?onboarding=skipped-storefront' as never);
  }

  const slug = formData.get('slug');
  if (typeof slug !== 'string') {
    return { ok: false, error: 'Slug zorunlu', slug: null, skipped: false };
  }

  const result = await saveStorefront(session.user.companyId, { slug }, db);
  if (!result.ok) {
    return {
      ok: false,
      error: result.issues[0] ?? 'Vitrin kaydedilemedi',
      slug,
      skipped: false,
    };
  }

  await completeOnboarding(session.user.id, db);
  redirect('/?onboarding=complete' as never);
}

// Sprint 3.0 — Onboarding 2. adım: İlk ürün (opsiyonel — atla ya da ekle, ikisi de Step 3'e geçer)

export interface FirstProductState {
  ok: boolean;
  error: string | null;
  /** true ise wizard kullanıcıya success göstermez, doğrudan Step 3'e geçer */
  skipped: boolean;
}

export async function firstProductAction(
  _prevState: FirstProductState | null,
  formData: FormData,
): Promise<FirstProductState> {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    redirect('/login' as never);
  }

  const skip = formData.get('skip') === 'true';
  if (skip) {
    return { ok: true, error: null, skipped: true };
  }

  const name = formData.get('name');
  const sku = formData.get('sku');
  const salePrice = formData.get('salePrice');

  if (typeof name !== 'string' || typeof sku !== 'string' || typeof salePrice !== 'string') {
    return { ok: false, error: 'Ürün adı, SKU ve satış fiyatı zorunlu', skipped: false };
  }

  const result = await createProduct(
    session.user.companyId,
    {
      name,
      variant: {
        valueLabel: 'Standart',
        sku,
        salePrice,
        threshold: 5,
      },
    },
    db,
  );

  if (!result.ok) {
    const msg = {
      invalid_input: result.issues?.[0] ?? 'Geçersiz alan',
      sku_taken: 'Bu SKU zaten kullanılıyor',
      slug_taken: 'Aynı isimde ürün var',
      unknown: 'Ürün oluşturulamadı',
    }[result.reason];
    return { ok: false, error: msg, skipped: false };
  }

  return { ok: true, error: null, skipped: false };
}
