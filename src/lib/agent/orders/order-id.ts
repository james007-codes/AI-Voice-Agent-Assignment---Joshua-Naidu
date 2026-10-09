/**
 * Normalises an order ID as it arrives from speech recognition.
 *
 * Customers say "order one oh one", "ORD 101", "o r d one zero one" or just
 * "101"; the transcription layer renders those inconsistently. Rather than
 * relying on the model to clean this up, we do it deterministically here so
 * that a valid order is never reported as "not found" because of formatting.
 */

const SPOKEN_DIGITS: Record<string, string> = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  // Hindi digits, for Hinglish speakers
  ek: "1",
  do: "2",
  teen: "3",
  char: "4",
  chaar: "4",
  paanch: "5",
  chhe: "6",
  saat: "7",
  aath: "8",
  nau: "9",
  shunya: "0",
};

export type OrderIdParseResult =
  | { ok: true; orderId: string }
  | { ok: false; reason: "EMPTY" | "NO_DIGITS" };

export function normalizeOrderId(raw: string | undefined | null): OrderIdParseResult {
  if (!raw || !raw.trim()) return { ok: false, reason: "EMPTY" };

  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    // split "ord101" into "ord 101"
    .replace(/([a-z])(\d)/g, "$1 $2")
    // spelled-out prefix "o r d" must go before "o" is read as zero
    .replace(/\bo\s+r\s+d\b/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !["ord", "order", "number", "no", "id"].includes(t));

  let digits = "";
  for (const token of tokens) {
    if (/^\d+$/.test(token)) digits += token;
    else if (token in SPOKEN_DIGITS) digits += SPOKEN_DIGITS[token];
  }

  if (!digits) return { ok: false, reason: "NO_DIGITS" };
  return { ok: true, orderId: `ORD-${digits}` };
}
