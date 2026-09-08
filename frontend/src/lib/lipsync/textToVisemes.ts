import type { VisemeType } from "./visemeTypes";

export type VisemeToken = {
  viseme: VisemeType;
  charIndex: number;
  charLength: number;
};

// Longest-match-first: multi-letter graphemes have to be checked before
// their individual letters (e.g. "th" before a lone "t"/"h") or they'd
// never be reached - order within this list doesn't matter beyond that,
// since each pattern is tried at every position independently.
const GRAPHEME_RULES: [pattern: string, viseme: VisemeType][] = [
  ["dge", "CH_SH_J"],
  ["th", "TH"],
  ["sh", "CH_SH_J"],
  ["ch", "CH_SH_J"],
  ["oo", "OU"],
  ["oa", "OH"],
  ["ee", "EE"],
  ["ea", "EE"],
];

const SINGLE_LETTER_RULES: Partial<Record<string, VisemeType>> = {
  m: "MBP",
  b: "MBP",
  p: "MBP",
  f: "FV",
  v: "FV",
  j: "CH_SH_J",
  l: "L",
  r: "R",
  a: "AA",
  o: "OH",
  u: "OU",
  e: "IH",
  i: "IH",
};

/**
 * Very approximate English text -> viseme sequence: a grapheme-matching
 * pass, not a real phonetic engine. Consonants with no dedicated group (t,
 * d, n, s, k, g, h, w, y, c, q, x, z) fall back to REST, same as
 * whitespace/punctuation - a deliberate V1 simplification (see the facial
 * morph target audit: no tongue morph target means these wouldn't read as
 * visually distinct from L/R/TH anyway), kept easy to extend later without
 * changing the shape of this function.
 */
export function textToVisemeSequence(text: string): VisemeToken[] {
  const tokens: VisemeToken[] = [];
  const lower = text.toLowerCase();
  let i = 0;

  while (i < lower.length) {
    const char = lower[i];

    if (/\s|[.,!?;:]/.test(char)) {
      tokens.push({ viseme: "REST", charIndex: i, charLength: 1 });
      i += 1;
      continue;
    }

    const grapheme = GRAPHEME_RULES.find(([pattern]) => lower.startsWith(pattern, i));
    if (grapheme) {
      const [pattern, viseme] = grapheme;
      tokens.push({ viseme, charIndex: i, charLength: pattern.length });
      i += pattern.length;
      continue;
    }

    tokens.push({ viseme: SINGLE_LETTER_RULES[char] ?? "REST", charIndex: i, charLength: 1 });
    i += 1;
  }

  return tokens;
}
