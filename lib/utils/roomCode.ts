/**
 * Generates an ambiguity-free and profanity-safe 6-character room code.
 *
 * Excluded:
 * - Vowels (A, E, I, O, U) -> Prevents accidental profanity or offensive English words.
 * - Confusing characters (0 vs O, 1 vs I/L) -> Eliminates visual ambiguity on mobile and paper.
 */
export function generateRoomCode(): string {
  const chars = 'BCDFGHJKMNPQRSTVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Extracts a 6-character trip room code from raw text, links, or WhatsApp share messages.
 * Handles:
 * - Direct codes (e.g. "TRP987", "trp987", "*TRP987*", "TRP-987", "TRP 987")
 * - Invite URLs (e.g. "https://.../trips/join?code=TRP987")
 * - Labeled text (e.g. "Room Code: TRP987", "(Room Code: TRP987)", "Code: *TRP987*")
 * - Full WhatsApp invite messages
 * - Ambiguity-free charset tokens (BCDFGHJKMNPQRSTVWXYZ23456789)
 */
export function extractRoomCode(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw) return null;

  // 1. Direct 6-character code (possibly wrapped in quotes, asterisks, brackets, backticks, spaces, or hyphen)
  const directMatch = raw.match(/^[*_~"`'([<{]*([A-Za-z0-9]{3}[-\s]?[A-Za-z0-9]{3})[*_~"`')\]}>]*$/);
  if (directMatch && directMatch[1]) {
    return directMatch[1].replace(/[-\s]/g, '').toUpperCase();
  }

  // 2. Query param ?code=XXXXXX or &code=XXXXXX in URL
  const urlParamMatch = raw.match(/[?&]code=([A-Za-z0-9]{6})\b/i);
  if (urlParamMatch && urlParamMatch[1]) {
    return urlParamMatch[1].toUpperCase();
  }

  // 3. Explicit label pattern like "Room Code: XXXXXX", "(Room Code: XXXXXX)", "Code: *XXXXXX*"
  const labelMatch = raw.match(/(?:room\s*code|trip\s*code|join\s*code|code)\s*[:#-]?\s*[*_~"`'(]*([A-Za-z0-9]{3}[-\s]?[A-Za-z0-9]{3})\b/i);
  if (labelMatch && labelMatch[1]) {
    return labelMatch[1].replace(/[-\s]/g, '').toUpperCase();
  }

  // 4. Standalone token matching TripSplit ambiguity-free charset BCDFGHJKMNPQRSTVWXYZ23456789
  const tripSplitTokenMatch = raw.match(/\b([BCDFGHJKMNPQRSTVWXYZ23456789]{6})\b/i);
  if (tripSplitTokenMatch && tripSplitTokenMatch[1]) {
    return tripSplitTokenMatch[1].toUpperCase();
  }

  // 5. Standalone 6-char token that contains at least one digit or is explicitly UPPERCASE in mixed text
  // e.g. "TRP987", "ABC123", or all-caps "JOINNOW" but NOT lowercase English words like "random"
  const mixedTokens = raw.match(/\b([A-Za-z0-9]{6})\b/g);
  if (mixedTokens) {
    for (const token of mixedTokens) {
      const hasDigit = /\d/.test(token);
      const isAllUpper = /^[A-Z0-9]{6}$/.test(token) && token !== token.toLowerCase();
      if (hasDigit || isAllUpper) {
        return token.toUpperCase();
      }
    }
  }

  return null;
}

