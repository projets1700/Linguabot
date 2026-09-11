import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardBanner } from "../src/components/RewardBanner";

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

  it("renders the level-up banner when levelUp is provided", () => {
    render(<RewardBanner badges={[]} trophies={[]} levelUp={{ code: "A2", name: "Explorateur" }} />);

    expect(screen.getByText(/Niveau A2 débloqué/)).toBeInTheDocument();
    expect(screen.getByText(/Explorateur/)).toBeInTheDocument();
  });

  it("does not render anything when levelUp is null and there are no rewards", () => {
    const { container } = render(<RewardBanner badges={[]} trophies={[]} levelUp={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
