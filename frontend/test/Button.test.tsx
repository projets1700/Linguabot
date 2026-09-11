import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../src/components/ui/Button";

describe("Button", () => {
  it("renders a native button and calls onClick when no `to` is given", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);

    const button = screen.getByRole("button", { name: "Valider" });
    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a react-router Link when `to` is given, not a button", () => {
    render(
      <MemoryRouter>
        <Button to="/dashboard">Retour</Button>
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: "Retour" });
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("applies disabled:opacity-50 and disables the button when disabled is set", () => {
    render(<Button disabled>Envoi...</Button>);

    const button = screen.getByRole("button", { name: "Envoi..." });
    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:opacity-50");
  });
});
