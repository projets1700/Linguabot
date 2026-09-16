import { describe, expect, it } from "vitest";
import { buildBlockedHelpMessage, isQuizHiddenForLevel } from "../src/lib/quizSpeech";

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
