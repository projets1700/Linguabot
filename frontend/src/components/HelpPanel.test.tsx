import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client";
import { HelpPanel } from "./HelpPanel";
import type { CecrlProfile } from "../types";

vi.mock("../api/client", () => ({
  api: { post: vi.fn() },
}));

function profile(overrides: Partial<CecrlProfile> = {}): CecrlProfile {
  return {
    transcriptMode: "onDemand",
    translationMode: "onDemand",
    hintMode: "progressive",
    helpVisibleByDefault: true,
    ...overrides,
  };
}

describe("HelpPanel", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
  });

  it("does not render a translate button when there is nothing to translate yet", () => {
    render(
      <HelpPanel profile={profile()} translateEndpoint="/sessions/1/translate" hintEndpoint="/sessions/1/hint" textToTranslate={null} />,
    );

    expect(screen.queryByRole("button", { name: /Traduire/ })).not.toBeInTheDocument();
  });

  it("fetches and displays a translation on demand", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { translation: "Comment ça va ?" } });
    const user = userEvent.setup();

    render(
      <HelpPanel
        profile={profile()}
        translateEndpoint="/sessions/1/translate"
        hintEndpoint="/sessions/1/hint"
        textToTranslate="How are you?"
      />,
    );

    await user.click(screen.getByRole("button", { name: /Traduire/ }));

    expect(api.post).toHaveBeenCalledWith("/sessions/1/translate", { text: "How are you?" });
    expect(await screen.findByText(/Comment ça va/)).toBeInTheDocument();
  });

  it("reveals hints one tier at a time, keeping earlier tiers visible", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { tier: 1, content: "name, I am, my name" } })
      .mockResolvedValueOnce({ data: { tier: 2, content: "My name is ..." } });
    const user = userEvent.setup();

    render(
      <HelpPanel profile={profile()} translateEndpoint="/sessions/1/translate" hintEndpoint="/sessions/1/hint" textToTranslate={null} />,
    );

    await user.click(screen.getByRole("button", { name: /Je suis bloqué/ }));
    expect(api.post).toHaveBeenLastCalledWith("/sessions/1/hint", { tier: 1 });
    expect(await screen.findByText(/name, I am, my name/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Encore un peu d'aide/ }));
    expect(api.post).toHaveBeenLastCalledWith("/sessions/1/hint", { tier: 2 });
    expect(await screen.findByText(/My name is/)).toBeInTheDocument();
    // Tier 1's hint is still shown - progressive help preserves earlier effort (V1 spec §11).
    expect(screen.getByText(/name, I am, my name/)).toBeInTheDocument();
  });

  it("merges hintBody into the hint request (daily challenge sends its stateless history)", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { tier: 1, content: "some hint" } });
    const user = userEvent.setup();

    render(
      <HelpPanel
        profile={profile()}
        translateEndpoint="/daily-challenge/translate"
        hintEndpoint="/daily-challenge/hint"
        textToTranslate={null}
        hintBody={{ history: [{ role: "assistant", content: "What would you like to order?" }] }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Je suis bloqué/ }));

    expect(api.post).toHaveBeenCalledWith("/daily-challenge/hint", {
      tier: 1,
      history: [{ role: "assistant", content: "What would you like to order?" }],
    });
  });

  it("shows a retryable error banner when the hint request fails", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("network error"));
    const user = userEvent.setup();

    render(
      <HelpPanel profile={profile()} translateEndpoint="/sessions/1/translate" hintEndpoint="/sessions/1/hint" textToTranslate={null} />,
    );

    await user.click(screen.getByRole("button", { name: /Je suis bloqué/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/indisponible/);
  });

  it("disables the hint button once the maximum tier has been reached", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { tier: 1, content: "hint 1" } })
      .mockResolvedValueOnce({ data: { tier: 2, content: "hint 2" } })
      .mockResolvedValueOnce({ data: { tier: 3, content: "hint 3" } });
    const user = userEvent.setup();

    render(
      <HelpPanel profile={profile()} translateEndpoint="/sessions/1/translate" hintEndpoint="/sessions/1/hint" textToTranslate={null} />,
    );

    await user.click(screen.getByRole("button", { name: /Je suis bloqué/ }));
    await user.click(await screen.findByRole("button", { name: /Encore un peu d'aide/ }));
    await user.click(await screen.findByRole("button", { name: /Encore un peu d'aide/ }));

    expect(await screen.findByRole("button", { name: /Aide maximale atteinte/ })).toBeDisabled();
    expect(api.post).toHaveBeenCalledTimes(3);
  });

  it("A0/A1 (fullAnswer): gives the complete example sentence on the first click and stops there", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { tier: 3, content: "I usually eat bread and eggs." } });
    const user = userEvent.setup();
    const onHintReceived = vi.fn();

    render(
      <HelpPanel
        profile={profile({ hintMode: "fullAnswer" })}
        translateEndpoint="/sessions/1/translate"
        hintEndpoint="/sessions/1/hint"
        textToTranslate={null}
        onHintReceived={onHintReceived}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Je suis bloqué/ }));

    // Requests the full-example tier directly - no keywords/starter step first.
    expect(api.post).toHaveBeenCalledWith("/sessions/1/hint", { tier: 3 });
    expect(await screen.findByText(/I usually eat bread and eggs/)).toBeInTheDocument();
    // The learner is meant to repeat it aloud, so the avatar says it too.
    expect(onHintReceived).toHaveBeenCalledWith("I usually eat bread and eggs.");
    expect(await screen.findByRole("button", { name: /Aide maximale atteinte/ })).toBeDisabled();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("A2/B1 (keywords): gives only keywords on the first click and stops there", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { tier: 1, content: "bread, eggs, usually" } });
    const user = userEvent.setup();
    const onHintReceived = vi.fn();

    render(
      <HelpPanel
        profile={profile({ hintMode: "keywords" })}
        translateEndpoint="/sessions/1/translate"
        hintEndpoint="/sessions/1/hint"
        textToTranslate={null}
        onHintReceived={onHintReceived}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Je suis bloqué/ }));

    expect(api.post).toHaveBeenCalledWith("/sessions/1/hint", { tier: 1 });
    expect(await screen.findByText(/bread, eggs, usually/)).toBeInTheDocument();
    // Keywords are read, not spoken for the learner to repeat.
    expect(onHintReceived).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /Aide maximale atteinte/ })).toBeDisabled();
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
