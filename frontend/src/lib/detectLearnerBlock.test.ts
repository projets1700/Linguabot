import { describe, expect, it } from "vitest";
import { detectLearnerBlock } from "./detectLearnerBlock";

describe("detectLearnerBlock", () => {
  it.each([
    "I don't know",
    "I dont know",
    "I do not know",
    "I don't understand",
    "I dont understand",
    "I do not understand",
    "I have no idea",
    "no idea",
    "I'm not sure",
    "I am not sure",
    "Can you help me",
    "can you help me?",
    "Help me",
  ])('detects "%s" as blocked', (transcript) => {
    expect(detectLearnerBlock(transcript).blocked).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(detectLearnerBlock("I DON'T KNOW").blocked).toBe(true);
  });

  it("ignores trailing punctuation", () => {
    expect(detectLearnerBlock("I don't know.").blocked).toBe(true);
    expect(detectLearnerBlock("I don't know!").blocked).toBe(true);
  });

  it("strips a leading filler word", () => {
    expect(detectLearnerBlock("Sorry, I don't know").blocked).toBe(true);
    expect(detectLearnerBlock("Um, no idea").blocked).toBe(true);
  });

  it("does not flag a normal, on-topic answer", () => {
    expect(detectLearnerBlock("I usually eat eggs and toast for breakfast.").blocked).toBe(false);
  });

  it("does not flag a real answer that merely contains similar words", () => {
    // Contains "no idea" as a substring, but the learner actually answered -
    // a naive includes() check would misfire here.
    expect(detectLearnerBlock("I have no idea what to eat, but I will say pizza.").blocked).toBe(false);
  });

  it("does not flag an unrelated sentence that happens to contain 'know'", () => {
    expect(detectLearnerBlock("You know, I really enjoy cooking on weekends.").blocked).toBe(false);
  });

  it("does not flag a real answer that happens to contain the word 'help'", () => {
    expect(detectLearnerBlock("My mother always helped me learn new words as a child.").blocked).toBe(false);
  });

  it("returns false for an empty transcript", () => {
    expect(detectLearnerBlock("").blocked).toBe(false);
  });
});
