import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardBanner } from "./RewardBanner";

describe("RewardBanner", () => {
  it("renders nothing when there are no new badges or trophies", () => {
    const { container } = render(<RewardBanner badges={[]} trophies={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one line per badge and per trophy", () => {
    render(
      <RewardBanner
        badges={[{ code: "BADGE_FIRST_STEP", name: "Premier pas", icon: "🌟" }]}
        trophies={[{ code: "TROPHY_EXPLORER", name: "Trophée Explorateur", rarity: "gold" }]}
      />,
    );

    expect(screen.getByText(/Premier pas/)).toBeInTheDocument();
    expect(screen.getByText(/Trophée Explorateur/)).toBeInTheDocument();
  });
});
