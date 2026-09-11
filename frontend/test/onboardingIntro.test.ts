import { describe, expect, it } from "vitest";
import { classifyOnboardingReadiness, isRecognizableNameReply } from "../src/lib/onboardingIntro";

describe("isRecognizableNameReply", () => {
  it.each([
    ["My name is Adam", true],
    ["I'm Adam", true],
    ["I am Adam", true],
    ["Adam", true],
    ["", false],
    ["um uh", false],
  ])("isRecognizableNameReply(%j) -> %j", (transcript, expected) => {
    expect(isRecognizableNameReply(transcript)).toBe(expected);
  });
});

describe("classifyOnboardingReadiness", () => {
  it.each([
    ["yes", "affirmative"],
    ["Yes!", "affirmative"],
    ["ready", "affirmative"],
    ["let's go", "affirmative"],
    ["ok", "affirmative"],
    ["no", "negative"],
    ["not now", "negative"],
    ["not yet", "negative"],
    ["I don't know", "ambiguous"],
    ["maybe", "ambiguous"],
    ["what did you say", "ambiguous"],
    ["", "ambiguous"],
  ] as const)("classifyOnboardingReadiness(%j) -> %j", (transcript, expected) => {
    expect(classifyOnboardingReadiness(transcript)).toBe(expected);
  });
});
