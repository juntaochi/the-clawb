const HTML_TAG_RE = /<[^>]*>/g;

/**
 * Sanitise chat text: strip HTML, trim, enforce max length.
 * Returns null when the result would be empty or the input is invalid.
 */
export function sanitizeChatText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(HTML_TAG_RE, "").trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, 500);
}

/**
 * Sanitise a nickname: strip HTML, trim, enforce max length.
 * Returns null when the result would be empty or the input is invalid.
 */
export function sanitizeNickname(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(HTML_TAG_RE, "").trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, 20);
}

/**
 * Type-guard: returns true only for the literal strings "dj" or "vj".
 */
export function isValidSlotType(input: unknown): input is "dj" | "vj" {
  return input === "dj" || input === "vj";
}

/**
 * Type-guard: returns true for strings that contain at least one
 * non-whitespace character.
 */
export function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}
