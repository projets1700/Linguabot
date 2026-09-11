import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import { LearnerStatsSection } from "../src/components/LearnerStatsSection";
import type { LearnerStats } from "../src/types";

// recharts' ResponsiveContainer relies on ResizeObserver, which jsdom
// doesn't provide (same reasoning as the AvatarScene stub used elsewhere
// for its own missing-browser-API problem) - stub every export this
// component actually uses so it renders as plain children instead.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  XAxis: () => null,
  Tooltip: () => null,
}));

let apiGetSpy: ReturnType<typeof vi.spyOn>;

function statsFixture(overrides: Partial<LearnerStats> = {}): LearnerStats {
  return {
    days: 30,
    sessionsCount: 3,
    practiceSeconds: 5400,
    quizzesCompleted: 2,
    challengesCompleted: 1,
    xpEarned: 420,
    categoryBreakdown: [
      { category: "quotidien", count: 2 },
      { category: "thematique", count: 1 },
    ],
    history: [
      { day: "2026-09-01", sessionsCount: 1, xpEarned: 100 },
      { day: "2026-09-02", sessionsCount: 2, xpEarned: 320 },
    ],
    ...overrides,
  };
}

describe("LearnerStatsSection", () => {
  beforeEach(() => {
    apiGetSpy = vi.spyOn(api, "get").mockResolvedValue({ data: statsFixture() });
  });

  afterEach(() => {
    apiGetSpy.mockRestore();
  });

  it("loads stats for the default 30-day period on mount", async () => {
    render(<LearnerStatsSection />);

    await waitFor(() => expect(apiGetSpy).toHaveBeenCalledWith("/me/stats", { params: { days: 30 } }));
    expect(await screen.findByText("420")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1h 30min")).toBeInTheDocument();
  });

  it("shows the category breakdown from the response", async () => {
    render(<LearnerStatsSection />);

    expect(await screen.findByText("Quotidien")).toBeInTheDocument();
    expect(screen.getByText("Thématique")).toBeInTheDocument();
  });

  it("refetches with the new period when a period button is clicked", async () => {
    render(<LearnerStatsSection />);
    await waitFor(() => expect(apiGetSpy).toHaveBeenCalledWith("/me/stats", { params: { days: 30 } }));

    apiGetSpy.mockResolvedValue({ data: statsFixture({ days: 7, sessionsCount: 9 }) });
    await act(async () => {
      screen.getByRole("button", { name: "7 jours" }).click();
    });

    await waitFor(() => expect(apiGetSpy).toHaveBeenCalledWith("/me/stats", { params: { days: 7 } }));
    expect(await screen.findByText("9")).toBeInTheDocument();
  });

  it("shows a retryable error banner and reloads on retry", async () => {
    apiGetSpy.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } });
    render(<LearnerStatsSection />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    apiGetSpy.mockResolvedValue({ data: statsFixture() });
    await act(async () => {
      screen.getByRole("button", { name: "Réessayer" }).click();
    });

    expect(await screen.findByText("420")).toBeInTheDocument();
  });
});
