import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBanner } from "../src/components/ui/ErrorBanner";

describe("ErrorBanner", () => {
  it("renders the message in an alert region", () => {
    render(<ErrorBanner message="Échec de l'envoi." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Échec de l'envoi.");
  });

  it("does not render a retry button when onRetry is omitted", () => {
    render(<ErrorBanner message="Échec de l'envoi." />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a retry button and calls onRetry when clicked", async () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Échec de l'envoi." onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("honours a custom retry label", () => {
    render(<ErrorBanner message="Échec." onRetry={() => {}} retryLabel="Recharger" />);

    expect(screen.getByRole("button", { name: "Recharger" })).toBeInTheDocument();
  });
});
