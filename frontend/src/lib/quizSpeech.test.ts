import { describe, expect, it } from "vitest";
import { buildBlockedHelpMessage, buildSpokenQuizQuestion } from "./quizSpeech";

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
