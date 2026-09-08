import { describe, expect, it } from "vitest";
import { selectPracticeSentence } from "./selectPracticeSentence";

describe("selectPracticeSentence", () => {
  it("uses the whole message when it is a single, reasonably short sentence", () => {
    expect(selectPracticeSentence("I would like to book a table.", "B1")).toBe("I would like to book a table.");
  });

  it("picks one sentence out of several", () => {
    const result = selectPracticeSentence("Hello! What is your name? Nice to meet you.", "A1");
    expect(["Hello!", "What is your name?", "Nice to meet you."]).toContain(result);
  });

  it("returns null for an empty message", () => {
    expect(selectPracticeSentence("", "A1")).toBeNull();
  });

  it("returns null for a message that is only whitespace", () => {
    expect(selectPracticeSentence("   \n  ", "A1")).toBeNull();
  });

  it("splits correctly regardless of punctuation style and returns text unmodified", () => {
    const result = selectPracticeSentence('She asked, "Are you ready?" and smiled.', "B1");
    expect(result).toBe('She asked, "Are you ready?" and smiled.');
  });

  it("falls back to the closest real sentence, unmodified, when every sentence is very long", () => {
    const long =
      "This is an extremely long sentence that goes on and on with many clauses and details that no learner would ever be asked to repeat aloud in one breath during a short pronunciation exercise.";
    const result = selectPracticeSentence(long, "A0");
    // Never invented/shortened - the one real sentence, verbatim, even though it's far from A0's ideal range.
    expect(result).toBe(long);
  });

  it("returns null when the only content is a list", () => {
    expect(selectPracticeSentence("- First item.\n- Second item.\n- Third item.", "B1")).toBeNull();
  });

  it("returns null when the only content is technical/markup", () => {
    expect(selectPracticeSentence("Visit https://example.com for more info.", "B1")).toBeNull();
  });

  it("selects a short sentence for A0", () => {
    // Real captured LinguaBot reply at A1 (adjacent tier) - reused here to
    // confirm a genuinely short candidate wins for the shortest level too.
    const reply = "Hi! Nice to meet you too.\n\nWhat is your name?";
    expect(selectPracticeSentence(reply, "A0")).toBe("Nice to meet you too.");
  });

  it("selects a short-to-medium sentence for A1 (real captured LinguaBot reply)", () => {
    const reply = "Hi! Nice to meet you too.\n\nWhat is your name?";
    expect(selectPracticeSentence(reply, "A1")).toBe("Nice to meet you too.");
  });

  it("selects a medium sentence for A2", () => {
    const reply =
      "Welcome! I can help you with that today. What specific product are you looking for this afternoon?";
    expect(selectPracticeSentence(reply, "A2")).toBe("I can help you with that today.");
  });

  it("selects a longer sentence for B1", () => {
    const reply =
      "Sure. Could you tell me a bit more about your previous work experience and what you are hoping to find here?";
    expect(selectPracticeSentence(reply, "B1")).toBe(
      "Could you tell me a bit more about your previous work experience and what you are hoping to find here?",
    );
  });

  it("selects the closest real sentence for B2 even when every sentence runs long (real captured LinguaBot reply)", () => {
    const reply =
      "That's a compelling stance to take, and certainly one that aligns with much of the current discourse " +
      "regarding mental health and digital well-being. However, as a journalist, I'm always interested in " +
      'exploring the nuances rather than accepting a binary view.\n\nWhen you say "mostly negative," could you ' +
      "elaborate on specific mechanisms you believe cause this harm?";
    expect(selectPracticeSentence(reply, "B2")).toBe(
      'When you say "mostly negative," could you elaborate on specific mechanisms you believe cause this harm?',
    );
  });

  it("falls back to a middling range for an unrecognized level code", () => {
    const result = selectPracticeSentence("Hello there. What is your favorite food to eat on weekends?", "XX");
    expect(result).toBe("What is your favorite food to eat on weekends?");
  });

  it("falls back to a middling range when no level code is given", () => {
    const result = selectPracticeSentence("Hello there. What is your favorite food to eat on weekends?");
    expect(result).toBe("What is your favorite food to eat on weekends?");
  });
});
