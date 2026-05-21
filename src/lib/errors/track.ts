/**
 * trackError — Sentry replacement (PLAN-BETA-PERFORMANCE FAZ 2.B).
 *
 * Server action / API route catch'lerinden çağrılır:
 *   await trackError(err, { route: '/admin/products', action: 'product.create' }, db);
 *
 * Akış:
 *   1. err.name + message + stack normalize
 *   2. PII strip (email + IP + TC/VKN) — KVKK ihlal koruması
 *   3. system_errors INSERT (fire-and-forget — track fail asla caller'ı bozmasın)
 *
 * Telegram burst alert: threshold-check cron (03:55 UTC) son 60 dk içinde
 * aynı errorType'ı 5+ kez gördüyse Telegram critical alert atar. 6 saat
 * dedup (anti-spam).
 */
import type { DbClient } from '@/lib/db/client';
import { systemErrors } from '@/db/schema';

export interface ErrorContext {
  companyId?: string | null;
  userId?: string | null;
  route?: string | null;
  action?: string | null;
  metadata?: Record<string, unknown>;
}

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface TrackedErrorInput {
  err: unknown;
  context: ErrorContext;
  severity?: ErrorSeverity;
  errorTypeOverride?: string;
}

const STACK_LIMIT = 4000;
const MESSAGE_LIMIT = 2000;
const ERROR_TYPE_LIMIT = 80;
const ROUTE_LIMIT = 200;
const ACTION_LIMIT = 80;

/**
 * PII strip — KVKK uyumlu. system_errors.message + stack içinden
 * email/IP/TCKN/VKN paternleri çıkar.
 */
export function sanitizePii(input: string): string {
  if (!input) return input;
  return input
    .replace(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, '[email]')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]')
    // IPv6 partial (basit)
    .replace(/\b(?:[a-fA-F0-9]{1,4}:){4,7}[a-fA-F0-9]{1,4}\b/g, '[ip6]')
    // 10-11 hane TCKN/VKN
    .replace(/\b\d{10,11}\b/g, '[tckn-vkn]');
}

export function extractErrorType(err: unknown, override?: string): string {
  if (override) return override.slice(0, ERROR_TYPE_LIMIT);
  if (err instanceof Error && err.name) return err.name.slice(0, ERROR_TYPE_LIMIT);
  return 'UnknownError';
}

export function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function extractStack(err: unknown): string | null {
  if (err instanceof Error && err.stack) return err.stack;
  return null;
}

/**
 * Async track — caller bekleyebilir veya fire-and-forget yapabilir.
 * Hata yutulur (track fail asla caller'ı bozmamalı).
 */
export async function trackError(
  err: unknown,
  context: ErrorContext = {},
  db: DbClient,
  options: { severity?: ErrorSeverity; errorTypeOverride?: string } = {},
): Promise<{ ok: boolean; id?: string }> {
  try {
    const errorType = extractErrorType(err, options.errorTypeOverride);
    const rawMessage = extractMessage(err).slice(0, MESSAGE_LIMIT);
    const rawStack = extractStack(err)?.slice(0, STACK_LIMIT) ?? null;
    const message = sanitizePii(rawMessage);
    const stack = rawStack ? sanitizePii(rawStack) : null;
    const severity = options.severity ?? 'error';

    const sanitizedContext: Record<string, unknown> | null = context.metadata
      ? sanitizeContextMetadata(context.metadata)
      : null;

    const rows = await db
      .insert(systemErrors)
      .values({
        errorType,
        message,
        stack,
        severity,
        context: sanitizedContext,
        companyId: context.companyId ?? null,
        userId: context.userId ?? null,
        route: context.route?.slice(0, ROUTE_LIMIT) ?? null,
        action: context.action?.slice(0, ACTION_LIMIT) ?? null,
      })
      .returning({ id: systemErrors.id });
    return { ok: true, id: rows[0]?.id };
  } catch {
    // Track fail asla bozmasın.
    return { ok: false };
  }
}

/** Fire-and-forget — server action içinde tipik kullanım. */
export function trackErrorAsync(
  err: unknown,
  context: ErrorContext = {},
  db: DbClient,
  options: { severity?: ErrorSeverity; errorTypeOverride?: string } = {},
): void {
  void trackError(err, context, db, options).catch(() => {
    /* silent */
  });
}

function sanitizeContextMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (typeof v === 'string') {
      result[k] = sanitizePii(v);
    } else if (Array.isArray(v)) {
      result[k] = v.map((item) =>
        typeof item === 'string' ? sanitizePii(item) : item,
      );
    } else if (v && typeof v === 'object') {
      // 1 seviye recurse (deep objelerde gereksiz)
      result[k] = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([ik, iv]) => [
          ik,
          typeof iv === 'string' ? sanitizePii(iv) : iv,
        ]),
      );
    } else {
      result[k] = v;
    }
  }
  return result;
}
