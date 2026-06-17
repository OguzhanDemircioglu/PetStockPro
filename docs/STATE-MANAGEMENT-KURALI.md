# State Management Kuralı — PetStockPro

> 2026-06-17 mimari denetim kararı. Bu kural CLAUDE.md "sade tut" ilkesinin frontend karşılığı.
> Plan: [PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE.md](PLAN-MIMARI-SAGLAMLASTIRMA-VE-STATE.md) §FAZ 2.

## Zihinsel model

> **Client tarafında veritabanı YOKTUR.** Sorgulaması ucuz bir server veritabanı vardır;
> UI onun üstünde ince, çoğunlukla state'siz bir görünümdür. Tek-kullanıcı + manuel giriş
> profili için en basit ve en sağlam yaklaşım budur.

## Verinin yeri — nereye ne koyulur

| Veri türü | Nerede durur | Örnek |
|---|---|---|
| **Server state** (ürün, stok, hareket, sayım) | RSC (Server Component) fetch + Server Action mutate. Sadece **canlı adacıklar** için TanStack Query. | /admin/products listesi RSC; bildirim bell'i TanStack |
| **Referans verisi** (global, statik: kategori, marka, il) | Server-side `unstable_cache` + `updateTag` invalidation. **Client store DEĞİL.** | `getCachedCategories` / `getCachedBrands` / `getAllCities` (`lib/cache/request-scoped.ts`) |
| **URL state** (filtre, sayfa, seçili sekme) | `searchParams`. Bedava paylaşılabilirlik + geri tuşu. | `/admin/stock-movements?branch=...` |
| **Efemerel UI state** (açık drawer, form taslağı) | Lokal `useState`/`useReducer`. | drawer aç/kapa |

## Yasaklar (2026-06-17 denetimi — bunlar mimariyi bozar)

1. **"Login'de her şeyi store'a yükle" KATMANI YOK.** Server state'i bir client store'a kopyalamak cache-coherence bug sınıfını davet eder.
2. **Async / fire-and-forget transactional yazma YOK.** Stok/ledger yazmaları her zaman server-otoriter + onaylı. "Store'u güncelle, DB'yi arka planda yaz" = sessiz stok bozulması (bu bir stok defteri ürünü).
3. **Store-as-source-of-truth YOK.** Postgres tek doğruluk kaynağıdır — vitrin/rapor/fatura onu okur; tarayıcı belleği truth olamaz.
4. **Zustand YOK.** 2026-06-17'de bağımlılıktan kaldırıldı. Yeniden ekleme. (Gerçek offline gereksinimi doğarsa → Replicache/ElectricSQL gibi bir sync engine, elle store değil.)

## Transactional optimistic-onaylı pattern (kanonik)

Canlı bir widget'ta anlık his isteniyorsa (toggle, mark-read), **optimistic-ama-onaylı** kullan —
asla decoupled/async değil:

```
useMutation({
  onMutate: async (vars) => {              // 1. ekranı ANINDA güncelle
    await qc.cancelQueries({ queryKey });
    const prev = qc.getQueryData(queryKey);
    qc.setQueryData(queryKey, optimistic); // optimistik flip
    return { prev };                        // rollback için snapshot
  },
  onError: (_e, _vars, ctx) => {           // 2. hata → geri al
    qc.setQueryData(queryKey, ctx.prev);
    // + SWAL hata toast
  },
  onSettled: () => qc.invalidateQueries({ queryKey }), // 3. server ile mutabık kal
});
```

**Kanonik örnekler** (kopya-yapıştır referansı):
- `src/app/admin/products/list-row-toggle.tsx` — vitrin Aç/Kapat optimistic toggle.
- `src/app/admin/notifications/notifications-list.tsx` — okundu işaretleme + bell badge.
- `src/components/notification-bell.tsx` — cache-reactive sayaç.

**Kural:** UI "kaydediliyor…" → server `ok:true` → "kaydedildi ✓". Başarı ancak server onaylayınca kesindir.

## Referans cache pattern (kanonik)

Global + statik veri (kategori/marka/il) her navigasyonda DB'den çekilmez:
```ts
export const getCachedCategories = unstable_cache(
  async () => db.select({...}).from(categories).orderBy(categories.displayOrder),
  ['categories-all'],
  { revalidate: 3600, tags: ['categories'] },
);
```
Mutasyon (SUPERADMIN) sonrası **server action içinde** `updateTag('categories')` → anında tazelenir
(read-your-own-writes). `updateTag` Next 16'da tek-arg doğru API'dir (`revalidateTag` artık 2-arg/deprecated).
