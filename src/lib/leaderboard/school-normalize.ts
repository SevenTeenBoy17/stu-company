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
