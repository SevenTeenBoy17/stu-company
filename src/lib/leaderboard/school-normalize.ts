/**
 * School-name normalization for dedup (decision 2: school is self-input, so the
 * `schools` table dedups on `(normalized_name, city_code)` + moderation).
 *
 * Conservative: NFKC (full-width -> half-width), drop whitespace + common
 * punctuation, lowercase latin. Synonym merging like "七中" <-> "第七中学" is
 * intentionally NOT done here — that's left to moderation to avoid wrong merges.
 */
export function normalizeSchoolName(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·.,，。、_()（）【】[\]\-—!！?？:：;；"'""'']/gu, "");
}

/** Dedup key for a school within a city. */
export function schoolDedupKey(name: string, cityCode: string): string {
  return `${cityCode}:${normalizeSchoolName(name)}`;
}

/**
 * Sanitize public display text (alias / school name shown on boards): strip
 * control (\p{Cc}) and format (\p{Cf} — zero-width + bidi-override) characters to
 * prevent layout abuse on a board seen by other minors, collapse inner
 * whitespace, and trim. This is NOT a content-moderation filter
 * (profanity/impersonation is a separate product decision) — only objective,
 * safe character hardening. Full-width characters are preserved so nicknames
 * keep their intended look.
 */
export function sanitizeDisplayText(raw: string): string {
  return raw
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
