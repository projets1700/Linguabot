import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversationLog } from "../src/components/ConversationLog";

const MESSAGES = [
  { id: 1, role: "assistant" as const, content: "Hello! How are you?" },
  { id: 2, role: "user" as const, content: "I am fine, thanks." },
];

describe("ConversationLog", () => {
  it("hides the transcript by default, showing an audio-mode placeholder instead", () => {
    render(<ConversationLog messages={MESSAGES} />);

    expect(screen.queryByText("Hello! How are you?")).not.toBeInTheDocument();
    expect(screen.queryByText("I am fine, thanks.")).not.toBeInTheDocument();
    expect(screen.getByText(/Mode audio/)).toBeInTheDocument();
  });

  it("reveals the transcript when the learner says they didn't understand", () => {
    render(<ConversationLog messages={MESSAGES} />);

    fireEvent.click(screen.getByRole("button", { name: /Je n'ai pas compris/ }));

    expect(screen.getByText("Hello! How are you?")).toBeInTheDocument();
    expect(screen.getByText("I am fine, thanks.")).toBeInTheDocument();
  });

  it("shows the transcript by default when initialShowText is set (A0/A1 CECRL profile)", () => {
    render(<ConversationLog messages={MESSAGES} initialShowText />);

    expect(screen.getByText("Hello! How are you?")).toBeInTheDocument();
    expect(screen.queryByText(/Mode audio/)).not.toBeInTheDocument();
  });

  it("hides it again on a second click", () => {
    render(<ConversationLog messages={MESSAGES} />);

    const toggle = screen.getByRole("button", { name: /Je n'ai pas compris/ });
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Masquer le texte" }));

    expect(screen.queryByText("Hello! How are you?")).not.toBeInTheDocument();
    expect(screen.getByText(/Mode audio/)).toBeInTheDocument();
  });
});
