'use server';

/**
 * Onboarding Server Actions
 *
 * Wizard 2 adım (2026-06-16: "İlk ürün" adımı kaldırıldı):
 *   1. branchAction → createFirstBranch (zorunlu)
 *   2. storefrontAction → saveStorefront + completeOnboarding (opsiyonel/atla)
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { withTenant, withOwner } from '@/lib/db/with-tenant';
import {
  createFirstBranch,
  saveStorefront,
  completeOnboarding,
} from '@/lib/onboarding/actions';

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

  const companyId = session.user.companyId;
  const result = await withTenant(companyId, (tx) =>
    createFirstBranch(
      companyId,
      {
        name,
        cityId,
        districtId,
        address: typeof address === 'string' && address.length > 0 ? address : undefined,
        whatsappPhone:
          typeof whatsappPhone === 'string' && whatsappPhone.length > 0 ? whatsappPhone : undefined,
      },
      tx,
    ),
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.issues[0] ?? 'Şube oluşturulamadı',
      issues: result.issues,
      branchId: null,
    };
  }

  // 2026-05-22 Migration 0026 — brands GLOBAL. Onboarding "Catalog markalarını
  // içeri aktar" checkbox kaldırıldı (artık her tenant'a brand seed yapılmıyor,
  // brand'ler global tabloda zaten tanımlı).
  return {
    ok: true,
    error: null,
    issues: [],
    branchId: result.branchId,
    brandsImported: null,
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

  const companyId = session.user.companyId;
  const userId = session.user.id;

  const skip = formData.get('skip') === 'true';
  if (skip) {
    // Vitrin atlandı — completeOnboarding (tenant) + redirect
    await withTenant(companyId, (tx) => completeOnboarding(userId, tx));
    redirect('/?onboarding=skipped-storefront' as never);
  }

  const slug = formData.get('slug');
  if (typeof slug !== 'string') {
    return { ok: false, error: 'Slug zorunlu', slug: null, skipped: false };
  }

  // saveStorefront cross-tenant slug-uniqueness kontrolü → withOwner (RLS bypass).
  const result = await withOwner((owner) => saveStorefront(companyId, { slug }, owner));
  if (!result.ok) {
    return {
      ok: false,
      error: result.issues[0] ?? 'Vitrin kaydedilemedi',
      slug,
      skipped: false,
    };
  }

  await withTenant(companyId, (tx) => completeOnboarding(userId, tx));
  redirect('/?onboarding=complete' as never);
}
