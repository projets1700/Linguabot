import { describe, expect, it } from "vitest";
import { matchRecognizedText, normalizeForMatch } from "../src/lib/textMatch";

describe("normalizeForMatch", () => {
  it("lowercases, trims, and collapses multiple spaces", () => {
    expect(normalizeForMatch("  I Would   Like  ")).toBe("i would like");
  });

  it("strips common punctuation", () => {
    expect(normalizeForMatch("Hello, world!")).toBe("hello world");
  });

  it("normalizes typographic apostrophes to a plain one", () => {
    expect(normalizeForMatch("I’d like a coffee")).toBe("i'd like a coffee");
  });
});

describe("matchRecognizedText", () => {
  it("returns matched for an exact match", () => {
    expect(matchRecognizedText("I would like to book a table.", "I would like to book a table.")).toBe("matched");
  });

  it("returns matched when only the case differs", () => {
    expect(matchRecognizedText("I would like to book a table.", "i WOULD like to BOOK a table")).toBe("matched");
  });

  it("returns matched when only punctuation differs", () => {
    expect(matchRecognizedText("I would like to book a table.", "I would like to book a table")).toBe("matched");
  });

  it("returns matched when only whitespace differs", () => {
    expect(matchRecognizedText("I would like to book a table.", "I  would   like to book a table")).toBe("matched");
  });

  it("returns close when one word out of a short phrase is missing", () => {
    // 3 of 4 words ("you" missing) - a 75% overlap, between the "close" and
    // "matched" thresholds.
    expect(matchRecognizedText("Nice to meet you.", "Nice to meet")).toBe("close");
  });

  it("returns matched when a single word is missing from a longer phrase", () => {
    // 6 of 7 words - still above the matched threshold despite one miss,
    // since real recognition regularly drops a short word even on a
    // correctly spoken sentence.
    expect(matchRecognizedText("I would like to book a table.", "I would like to book a")).toBe("matched");
  });

  it("returns close when a single key word is replaced by an unrelated word", () => {
    // 4 of 5 words still match ("coffee" vs "bicycle") - not exact, not
    // unrelated either, so it lands in "close" rather than "retry".
    expect(matchRecognizedText("I would like a coffee.", "I would like a bicycle")).toBe("close");
  });

  it("returns retry when most key words are replaced by unrelated words", () => {
    expect(matchRecognizedText("I would like a coffee.", "The weather is quite cold")).toBe("retry");
  });

  it("returns retry for a completely different sentence", () => {
    expect(matchRecognizedText("I would like to book a table.", "What time is it")).toBe("retry");
  });

  it("returns retry for an empty recognized string", () => {
    expect(matchRecognizedText("I would like to book a table.", "")).toBe("retry");
  });

  it("returns retry for a recognized string that is only whitespace", () => {
    expect(matchRecognizedText("I would like to book a table.", "   ")).toBe("retry");
  });

  it("returns matched for a short exact phrase", () => {
    expect(matchRecognizedText("Hello.", "hello")).toBe("matched");
  });
});
