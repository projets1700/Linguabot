import { describe, expect, it } from "vitest";
import { buildBlockedHelpMessage, buildSpokenQuizQuestion, isQuizHiddenForLevel } from "../src/lib/quizSpeech";

describe("buildSpokenQuizQuestion", () => {
  it("translates the French wrapper to English, keeping the quoted word as-is", () => {
    expect(buildSpokenQuizQuestion('Comment dit-on "Bonjour" ?')).toBe('How do you say "Bonjour"?');
  });

  it("keeps a quoted phrase with an apostrophe intact", () => {
    expect(buildSpokenQuizQuestion('Comment dit-on "S\'il vous plaît" ?')).toBe('How do you say "S\'il vous plaît"?');
  });

  it("keeps a quoted phrase that itself contains a question mark intact", () => {
    expect(buildSpokenQuizQuestion('Comment dit-on "Comment ça va ?" ?')).toBe('How do you say "Comment ça va ?"?');
  });

  it("falls back to the original text when no quoted word is found", () => {
    expect(buildSpokenQuizQuestion("Une question sans guillemets")).toBe("Une question sans guillemets");
  });
});

describe("buildBlockedHelpMessage", () => {
  it("presents the known correct answer as something the learner can say", () => {
    expect(buildBlockedHelpMessage("hello")).toBe("You can say: hello.");
  });
});

describe("isQuizHiddenForLevel", () => {
  it("keeps the quiz reachable at A0 and A1", () => {
    expect(isQuizHiddenForLevel("A0")).toBe(false);
    expect(isQuizHiddenForLevel("A1")).toBe(false);
  });

  it("hides the quiz at A2, B1 and B2", () => {
    expect(isQuizHiddenForLevel("A2")).toBe(true);
    expect(isQuizHiddenForLevel("B1")).toBe(true);
    expect(isQuizHiddenForLevel("B2")).toBe(true);
  });

  it("treats an unknown level as not hidden", () => {
    expect(isQuizHiddenForLevel(undefined)).toBe(false);
  });
});
