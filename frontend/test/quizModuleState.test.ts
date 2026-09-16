import { describe, expect, it } from "vitest";
import { levelUpProgressPercent, quizModuleState, remainingCorrectAnswers } from "../src/lib/quizModuleState";
import type { QuizModule } from "../src/types";

function makeModule(overrides: Partial<QuizModule> = {}): QuizModule {
  return {
    id: 1,
    code: "M0-1",
    title: "Greetings",
    questionCount: 10,
    passed: false,
    attempted: false,
    bestScore: null,
    ...overrides,
  };
}

describe("quizModuleState", () => {
  it("is 'not-started' when the module has never been attempted", () => {
    expect(quizModuleState(makeModule())).toBe("not-started");
  });

  it("is 'retry' when attempted but not passed", () => {
    expect(quizModuleState(makeModule({ attempted: true, passed: false, bestScore: 5 }))).toBe("retry");
  });

  it("is 'passed' once passed is true, regardless of attempted", () => {
    expect(quizModuleState(makeModule({ attempted: true, passed: true, bestScore: 9 }))).toBe("passed");
  });
});

describe("remainingCorrectAnswers", () => {
  it("returns the gap between the threshold and the best score", () => {
    expect(remainingCorrectAnswers(7, 4)).toBe(3);
  });

  it("never returns a negative value once the score already clears the threshold", () => {
    expect(remainingCorrectAnswers(7, 9)).toBe(0);
    expect(remainingCorrectAnswers(7, 7)).toBe(0);
  });
});

describe("levelUpProgressPercent", () => {
  it("computes progress against requiredForLevelUp, not a fixed total", () => {
    expect(levelUpProgressPercent(2, 4)).toBe(50);
  });

  it("is 0% with no passed modules", () => {
    expect(levelUpProgressPercent(0, 4)).toBe(0);
  });

  it("caps at 100% once requiredForLevelUp is reached or exceeded", () => {
    expect(levelUpProgressPercent(4, 4)).toBe(100);
    expect(levelUpProgressPercent(6, 4)).toBe(100);
  });

  it("does not divide by zero if requiredForLevelUp is somehow 0", () => {
    expect(levelUpProgressPercent(0, 0)).toBe(100);
  });
});
