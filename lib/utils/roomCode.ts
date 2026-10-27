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
