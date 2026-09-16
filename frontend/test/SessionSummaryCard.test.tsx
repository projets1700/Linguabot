import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionSummaryCard } from "../src/components/SessionSummaryCard";
import type { SessionSummary } from "../src/types";

function baseSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    summary: "You confidently practiced ordering at a restaurant.",
    exchangeCount: 3,
    xpEarned: 45,
    status: "completed",
    scenarioTitle: "Commander au restaurant",
    strengths: [],
    reviewPoints: [],
    usefulExpressions: [],
    nextStep: "Try a new scenario at the same level.",
    ...overrides,
  };
}

describe("SessionSummaryCard", () => {
  it("shows the summary text and the exchange count / XP line", () => {
    render(<SessionSummaryCard summary={baseSummary()} />);

    expect(screen.getByText("You confidently practiced ordering at a restaurant.")).toBeInTheDocument();
    expect(screen.getByText("3 exchanges · +45 XP")).toBeInTheDocument();
  });

  it("uses the singular form for exactly one exchange", () => {
    render(<SessionSummaryCard summary={baseSummary({ exchangeCount: 1 })} />);

    expect(screen.getByText("1 exchange · +45 XP")).toBeInTheDocument();
  });

  it("shows the strengths section when present", () => {
    render(<SessionSummaryCard summary={baseSummary({ strengths: ["Used full sentences", "Stayed on topic"] })} />);

    expect(screen.getByText(/Strengths/)).toBeInTheDocument();
    expect(screen.getByText("Used full sentences")).toBeInTheDocument();
    expect(screen.getByText("Stayed on topic")).toBeInTheDocument();
  });

  it("shows the review points section when present", () => {
    render(<SessionSummaryCard summary={baseSummary({ reviewPoints: ["Try longer answers"] })} />);

    expect(screen.getByText(/To review/)).toBeInTheDocument();
    expect(screen.getByText("Try longer answers")).toBeInTheDocument();
  });

  it("shows the useful expressions section when present", () => {
    render(<SessionSummaryCard summary={baseSummary({ usefulExpressions: ["I would like...", "thank you"] })} />);

    expect(screen.getByText(/Useful expressions/)).toBeInTheDocument();
    expect(screen.getByText("I would like...")).toBeInTheDocument();
    expect(screen.getByText("thank you")).toBeInTheDocument();
  });

  it("shows the next-step suggestion", () => {
    render(<SessionSummaryCard summary={baseSummary()} />);

    expect(screen.getByText(/For next time/)).toBeInTheDocument();
    expect(screen.getByText("Try a new scenario at the same level.")).toBeInTheDocument();
  });

  it("hides strengths/reviewPoints/usefulExpressions sections entirely when empty (deterministic fallback shape)", () => {
    render(<SessionSummaryCard summary={baseSummary()} />);

    expect(screen.queryByText(/Strengths/)).not.toBeInTheDocument();
    expect(screen.queryByText(/To review/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Useful expressions/)).not.toBeInTheDocument();
    // The summary and next step still render even with nothing else - a
    // fallback bilan never looks broken/empty.
    expect(screen.getByText(/Summary/)).toBeInTheDocument();
    expect(screen.getByText(/For next time/)).toBeInTheDocument();
  });

  it("never renders a numeric score anywhere", () => {
    render(<SessionSummaryCard summary={baseSummary({ strengths: ["Good vocabulary"] })} />);

    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
