# PetStockPro

> Pet shop'lar için çok-kiracılı (multi-tenant) **stok takip + satış kaydı SaaS** platformu. Türkiye odaklı.

**Domain:** [petstockpro.com](https://petstockpro.com)
**Durum:** Sprint 0 — bootstrap aşaması
**Lisans:** Özel (private)

---

## Hızlı Başlangıç

```bash
# 1. Bağımlılıkları kur
npm install --legacy-peer-deps

# 2. .env dosyasını yapılandır (kopyala + Supabase credentials gir)
cp .env.example .env
# .env'i düzenle: DATABASE_URL, SUPABASE_*, AUTH_SECRET, ...

# 3. Supabase'i hazırla (SQL Editor'da çalıştır)
# → supabase-setup.sql dosyasını kopyala yapıştır

# 4. Drizzle ile şemayı push et
npm run db:push

# 5. (Sprint 1+) Seed verisini yükle
npm run db:seed

# 6. Dev server başlat
npm run dev   # http://localhost:3000
```

---

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack, React 19)
- **Veritabanı:** Supabase Postgres (Frankfurt EU, KVKK uyumlu) + Drizzle ORM
- **Auth:** Auth.js v5 (next-auth beta) + jose JWT (Cloudflare Workers uyumlu)
- **UI:** Tailwind CSS v4 + shadcn/ui pattern + Verdana font + tokens-v2 design system
- **State:** TanStack Query (server) + Zustand (client)
- **i18n:** next-intl (TR-only MVP, EN gizli)
- **Test:** Vitest + Testing Library + Playwright + axe-core
- **Deploy:** Cloudflare Workers + OpenNext (Sprint 14+)
- **Monitoring:** Sentry + Cloudflare Analytics + Telegram alerts ([docs/DEPLOYMENT.md §8](docs/DEPLOYMENT.md))

---

## Proje Yapısı

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (lang=tr, Verdana, KVKK meta)
│   ├── page.tsx            # Landing placeholder (Sprint 0)
│   ├── globals.css         # Tailwind v4 + design tokens
│   └── login/              # Login page (Sprint 2'de detay)
├── components/             # Shared UI components
│   └── ui/                 # shadcn/ui base
├── db/
│   ├── schema/             # Drizzle table definitions
│   └── seed/               # Seed scripts (cities, districts, ...)
├── lib/
│   ├── auth/               # Auth.js config
│   ├── constants/          # vat-rates, plan-limits, ...
│   ├── db/                 # Drizzle client
│   ├── realtime/           # Supabase Realtime helpers
│   └── validation/         # vatNo (TC/VKN), ...
└── messages/               # next-intl i18n
    └── tr.json             # Türkçe (TR-only MVP)

docs/                       # 24 tasarım dökümanı (otoritatif)
preview/                    # HTML mockup'lar (Verdana + tokens-v2)
assets/                     # Logo + tokens-v2.css + mascot
```

---

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Dev server (Turbopack, hot reload) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript tip kontrolü |
| `npm run lint` | ESLint |
| `npm run test` | Vitest watch mode |
| `npm run test:run` | Vitest tek seferlik |
| `npm run test:e2e` | Playwright E2E |
| `npm run db:generate` | Drizzle migration üret |
| `npm run db:push` | Drizzle ile şemayı DB'ye uygula |
| `npm run db:studio` | Drizzle Studio (DB explorer) |
| `npm run db:seed` | Seed verisini yükle |

---

## Sprint Roadmap

| Sprint | Hafta | İçerik |
|---|---|---|
| **0** | 1 | Bootstrap (mevcut) — Next.js + Drizzle + Auth.js + Supabase skeleton |
| 1 | 1 | Cities/Districts seed + Drizzle schema (36 tablo) |
| 2 | 2 | Auth — login + register + Turnstile + KVKK + 2FA + onboarding |
| 3-7 | 8 | Pano + Ürünler + Stok Hareketleri + Sayım + Düşük Stok |
| 8-11 | 8 | Şubeler + Tedarikçiler + Kullanıcılar + Ayarlar + Raporlar |
| 12 | 2 | Public Vitrin (merkezi tek, `/vitrin`) |
| 13 | 1 | iyzico subscription + plan limit gates |
| 14 | 1 | Nilvera e-Arşiv + Cloudflare Workers deploy |
| 15 | 1 | Performance + a11y + production hardening |
| 16 | 1 | Lansman |

Detay: [`docs/SPRINT-PLAN.md`](docs/SPRINT-PLAN.md)

---

## Dokümanlar

`docs/` altında 24 otoritatif doküman:

- **[CLAUDE.md](CLAUDE.md)** — Claude Code bağlam dosyası
- **[docs/DEVAM-REHBERI.md](docs/DEVAM-REHBERI.md)** — yeni session başlangıç noktası
- **[docs/TECH-STACK.md](docs/TECH-STACK.md)** — stack kararları + gerekçeler
- **[docs/DATABASE-SCHEMA.md](docs/DATABASE-SCHEMA.md)** — 36 tablo MVP
- **[docs/SPRINT-PLAN.md](docs/SPRINT-PLAN.md)** — 16 sprint × ~24 hafta
- **[docs/PAYMENT-INTEGRATION.md](docs/PAYMENT-INTEGRATION.md)** — iyzico + Nilvera
- **[docs/EKRAN-AUTH.md](docs/EKRAN-AUTH.md)** — auth akışları (15 bölüm + 52 test)
- ... (diğer EKRAN-*.md ekran spec'leri)

---

## Lisans

Özel (private). Tüm hakları saklıdır © 2026 PetStockPro.
