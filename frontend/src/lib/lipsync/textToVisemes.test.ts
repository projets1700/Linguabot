import { describe, expect, it } from "vitest";
import { textToVisemeSequence } from "./textToVisemes";

describe("textToVisemeSequence", () => {
  it("maps whitespace and punctuation to REST", () => {
    const tokens = textToVisemeSequence("a, a");
    expect(tokens.map((t) => t.viseme)).toEqual(["AA", "REST", "REST", "AA"]);
  });

  it("prefers a digraph over its individual letters", () => {
    // "th" must win over separate "t" (unmapped -> REST) + "h" (unmapped -> REST)
    const tokens = textToVisemeSequence("th");
    expect(tokens).toEqual([{ viseme: "TH", charIndex: 0, charLength: 2 }]);
  });

  it("maps the MBP group (m, b, p)", () => {
    expect(textToVisemeSequence("mbp").map((t) => t.viseme)).toEqual(["MBP", "MBP", "MBP"]);
  });

  it("maps the FV group (f, v)", () => {
    expect(textToVisemeSequence("fv").map((t) => t.viseme)).toEqual(["FV", "FV"]);
  });

  it("maps sh/ch/dge to a single CH_SH_J token each (digraphs, not per-letter)", () => {
    expect(textToVisemeSequence("sh")).toEqual([{ viseme: "CH_SH_J", charIndex: 0, charLength: 2 }]);
    expect(textToVisemeSequence("ch")).toEqual([{ viseme: "CH_SH_J", charIndex: 0, charLength: 2 }]);
    expect(textToVisemeSequence("dge")).toEqual([{ viseme: "CH_SH_J", charIndex: 0, charLength: 3 }]);
  });

  it("maps oo/oa/ee/ea digraphs", () => {
    expect(textToVisemeSequence("oo")).toEqual([{ viseme: "OU", charIndex: 0, charLength: 2 }]);
    expect(textToVisemeSequence("oa")).toEqual([{ viseme: "OH", charIndex: 0, charLength: 2 }]);
    expect(textToVisemeSequence("ee")).toEqual([{ viseme: "EE", charIndex: 0, charLength: 2 }]);
    expect(textToVisemeSequence("ea")).toEqual([{ viseme: "EE", charIndex: 0, charLength: 2 }]);
  });

  it("is case-insensitive", () => {
    expect(textToVisemeSequence("TH").map((t) => t.viseme)).toEqual(["TH"]);
  });

  it("falls back to REST for unmapped consonants", () => {
    expect(textToVisemeSequence("t").map((t) => t.viseme)).toEqual(["REST"]);
  });

  it("preserves charIndex/charLength so a caller can align to the original text", () => {
    const tokens = textToVisemeSequence("th a");
    expect(tokens).toEqual([
      { viseme: "TH", charIndex: 0, charLength: 2 },
      { viseme: "REST", charIndex: 2, charLength: 1 },
      { viseme: "AA", charIndex: 3, charLength: 1 },
    ]);
  });

  it("produces several distinct visemes across a real sentence", () => {
    const tokens = textToVisemeSequence("Peter bought five beautiful apples.");
    const distinctVisemes = new Set(tokens.map((t) => t.viseme));
    // MBP (p/b), FV (f/v), AA, and REST at minimum should all appear.
    expect(distinctVisemes.size).toBeGreaterThanOrEqual(4);
  });
});
