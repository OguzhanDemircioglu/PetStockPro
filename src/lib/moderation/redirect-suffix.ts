/**
 * Server action redirect query suffix — moderation flag varsa
 * `&moderation=flagged&fields=...` ekler. UI banner buradan okur.
 */
import type { ModerationReason } from './check';

export interface ModerationFlagsResult {
  flagged: boolean;
  fieldsFlagged: string[];
  reasons: ModerationReason[];
}

export function moderationRedirectSuffix(flags?: ModerationFlagsResult): string {
  if (!flags?.flagged) return '';
  return `&moderation=flagged&fields=${encodeURIComponent(flags.fieldsFlagged.join(','))}`;
}
