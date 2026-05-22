import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * OpenNext config for Cloudflare Workers deployment.
 *
 * Staging deploy (wrangler.staging.toml) ve production deploy (wrangler.toml)
 * aynı build output'unu kullanır. Hangi env'in çağrılacağını wrangler config
 * belirler.
 *
 * Defaults yeter — Hyperdrive/KV/R2 binding'leri staging'de yok, production'da
 * wrangler.toml'a uncomment + ID set.
 */
export default defineCloudflareConfig({});
