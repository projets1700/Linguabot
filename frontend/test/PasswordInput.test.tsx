import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "../src/components/ui/PasswordInput";

describe("PasswordInput", () => {
  it("masks the value by default", () => {
    render(<PasswordInput value="secret" onChange={vi.fn()} />);

    expect(screen.getByDisplayValue("secret")).toHaveAttribute("type", "password");
  });

  it("reveals the value as plain text on toggle, then masks it again", async () => {
    render(<PasswordInput value="secret" onChange={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: "Afficher le mot de passe" });
    await userEvent.click(toggle);

    expect(screen.getByDisplayValue("secret")).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "Masquer le mot de passe" }));

    expect(screen.getByDisplayValue("secret")).toHaveAttribute("type", "password");
  });

  it("forwards other input props such as required and minLength", () => {
    render(<PasswordInput value="" onChange={vi.fn()} required minLength={8} />);

    const input = screen.getByDisplayValue("");
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("minLength", "8");
  });
});
