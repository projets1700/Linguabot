import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionSummaryCard } from "./SessionSummaryCard";
import type { SessionSummary } from "../types";

function baseSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    summary: "Tu as pratiqué une commande au restaurant avec assurance.",
    exchangeCount: 3,
    xpEarned: 45,
    status: "completed",
    scenarioTitle: "Commander au restaurant",
    strengths: [],
    reviewPoints: [],
    usefulExpressions: [],
    nextStep: "Essaie un nouveau scénario au même niveau.",
    ...overrides,
  };
}

describe("SessionSummaryCard", () => {
  it("shows the summary text and the exchange count / XP line", () => {
    render(<SessionSummaryCard summary={baseSummary()} />);

    expect(screen.getByText("Tu as pratiqué une commande au restaurant avec assurance.")).toBeInTheDocument();
    expect(screen.getByText("3 échanges · +45 XP")).toBeInTheDocument();
  });

  it("uses the singular form for exactly one exchange", () => {
    render(<SessionSummaryCard summary={baseSummary({ exchangeCount: 1 })} />);

    expect(screen.getByText("1 échange · +45 XP")).toBeInTheDocument();
  });

  it("shows the strengths section when present", () => {
    render(<SessionSummaryCard summary={baseSummary({ strengths: ["Used full sentences", "Stayed on topic"] })} />);

    expect(screen.getByText(/Points positifs/)).toBeInTheDocument();
    expect(screen.getByText("Used full sentences")).toBeInTheDocument();
    expect(screen.getByText("Stayed on topic")).toBeInTheDocument();
  });

  it("shows the review points section when present", () => {
    render(<SessionSummaryCard summary={baseSummary({ reviewPoints: ["Try longer answers"] })} />);

    expect(screen.getByText(/À revoir/)).toBeInTheDocument();
    expect(screen.getByText("Try longer answers")).toBeInTheDocument();
  });

  it("shows the useful expressions section when present", () => {
    render(<SessionSummaryCard summary={baseSummary({ usefulExpressions: ["I would like...", "thank you"] })} />);

    expect(screen.getByText(/Expressions utiles/)).toBeInTheDocument();
    expect(screen.getByText("I would like...")).toBeInTheDocument();
    expect(screen.getByText("thank you")).toBeInTheDocument();
  });

  it("shows the next-step suggestion", () => {
    render(<SessionSummaryCard summary={baseSummary()} />);

    expect(screen.getByText(/Pour la prochaine fois/)).toBeInTheDocument();
    expect(screen.getByText("Essaie un nouveau scénario au même niveau.")).toBeInTheDocument();
  });

  it("hides strengths/reviewPoints/usefulExpressions sections entirely when empty (deterministic fallback shape)", () => {
    render(<SessionSummaryCard summary={baseSummary()} />);

    expect(screen.queryByText(/Points positifs/)).not.toBeInTheDocument();
    expect(screen.queryByText(/À revoir/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Expressions utiles/)).not.toBeInTheDocument();
    // The summary and next step still render even with nothing else - a
    // fallback bilan never looks broken/empty.
    expect(screen.getByText(/Résumé/)).toBeInTheDocument();
    expect(screen.getByText(/Pour la prochaine fois/)).toBeInTheDocument();
  });

  it("never renders a numeric score anywhere", () => {
    render(<SessionSummaryCard summary={baseSummary({ strengths: ["Good vocabulary"] })} />);

    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
