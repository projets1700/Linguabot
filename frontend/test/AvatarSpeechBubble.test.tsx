import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarSpeechBubble } from "../src/components/AvatarSpeechBubble";

describe("AvatarSpeechBubble", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when there is no text", () => {
    const { container } = render(<AvatarSpeechBubble text={null} active={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when text is set but the avatar isn't actively speaking yet", () => {
    const { container } = render(<AvatarSpeechBubble text="Hello!" active={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the exact text while the avatar is speaking", () => {
    render(<AvatarSpeechBubble text="Where would you like to go?" active={true} />);

    expect(screen.getByText("Where would you like to go?")).toBeInTheDocument();
  });

  it("renders a long line in full, without truncating it", () => {
    const longLine =
      "That's a really interesting question, and there are actually several ways to think about it depending on your own personal preferences and past experiences.";

    render(<AvatarSpeechBubble text={longLine} active={true} />);

    expect(screen.getByText(longLine)).toBeInTheDocument();
  });

  it("keeps showing the line briefly after speaking ends, then hides it", () => {
    const { rerender } = render(<AvatarSpeechBubble text="Nice to meet you." active={true} />);
    expect(screen.getByText("Nice to meet you.")).toBeInTheDocument();

    rerender(<AvatarSpeechBubble text={null} active={false} />);
    // Still visible right after speech ends (linger window).
    expect(screen.getByText("Nice to meet you.")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender(<AvatarSpeechBubble text={null} active={false} />);
    expect(screen.queryByText("Nice to meet you.")).not.toBeInTheDocument();
  });

  it("replaces the lingering line immediately once a new one starts", () => {
    const { rerender } = render(<AvatarSpeechBubble text="First line." active={true} />);
    rerender(<AvatarSpeechBubble text={null} active={false} />); // linger starts

    rerender(<AvatarSpeechBubble text="Second line." active={true} />);

    expect(screen.getByText("Second line.")).toBeInTheDocument();
    expect(screen.queryByText("First line.")).not.toBeInTheDocument();
  });

  it("uses an accessible live region so a screen reader announces the line", () => {
    render(<AvatarSpeechBubble text="Where would you like to go?" active={true} />);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Where would you like to go?");
  });

  it("is styled to wrap within a bounded width rather than stretching edge to edge (responsive)", () => {
    render(<AvatarSpeechBubble text="Hello!" active={true} />);

    const region = screen.getByRole("status");
    expect(region.className).toContain("max-w-");
  });

  it("shows nothing revealed yet the instant speech starts, when a charIndexRef is provided", () => {
    const charIndexRef = { current: null as number | null };
    render(<AvatarSpeechBubble text="Hello there, how are you?" active={true} charIndexRef={charIndexRef} />);

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("reveals the line progressively as charIndexRef advances (a real boundary signal)", () => {
    const charIndexRef = { current: null as number | null };
    render(<AvatarSpeechBubble text="Hello there, how are you?" active={true} charIndexRef={charIndexRef} />);
    const region = screen.getByRole("status");

    charIndexRef.current = 5;
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(region.textContent).toBe("Hello");

    charIndexRef.current = 17;
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(region.textContent).toBe("Hello there, how ");
  });

  it("never reveals fewer characters than already shown, even if charIndexRef briefly reports a lower value", () => {
    const charIndexRef = { current: null as number | null };
    render(<AvatarSpeechBubble text="Hello there, how are you?" active={true} charIndexRef={charIndexRef} />);
    const region = screen.getByRole("status");

    charIndexRef.current = 10;
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(region.textContent).toBe("Hello ther");

    charIndexRef.current = 6; // a stray/out-of-order boundary event
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(region.textContent).toBe("Hello ther");
  });

  it("falls back to the full line if no boundary signal ever arrives (charIndexRef stays null)", () => {
    const charIndexRef = { current: null as number | null };
    render(<AvatarSpeechBubble text="Nice to meet you." active={true} charIndexRef={charIndexRef} />);
    const region = screen.getByRole("status");

    expect(region.textContent).toBe("");

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(region.textContent).toBe("Nice to meet you.");
  });

  it("snaps to the full line once speaking ends, even if the reveal hadn't finished", () => {
    const charIndexRef = { current: null as number | null };
    const { rerender } = render(
      <AvatarSpeechBubble text="Hello there, how are you?" active={true} charIndexRef={charIndexRef} />,
    );
    charIndexRef.current = 5;
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(screen.getByRole("status").textContent).toBe("Hello");

    rerender(<AvatarSpeechBubble text={null} active={false} charIndexRef={charIndexRef} />);

    expect(screen.getByRole("status").textContent).toBe("Hello there, how are you?");
  });

  it("shows the full line immediately when no charIndexRef is passed at all (backward compatible)", () => {
    render(<AvatarSpeechBubble text="Hello there, how are you?" active={true} />);

    expect(screen.getByRole("status").textContent).toBe("Hello there, how are you?");
  });
});
