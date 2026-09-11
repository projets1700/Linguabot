import { describe, expect, it } from "vitest";
import { detectDashboardDestination, detectDashboardReadyIntent } from "../src/lib/dashboardIntro";

describe("detectDashboardReadyIntent", () => {
  it.each([
    ["oui", true],
    ["Oui !", true],
    ["oui, je suis prêt", true],
    ["yes", true],
    ["Yeah.", true],
    ["I'm ready", true],
    ["i’m ready", true],
    ["let's go", true],
    ["let's go on holiday", false],
    ["je ne sais pas", false],
    ["peut-être plus tard", false],
    ["", false],
  ])("detectDashboardReadyIntent(%j) -> %j", (transcript, expected) => {
    expect(detectDashboardReadyIntent(transcript)).toBe(expected);
  });
});

describe("detectDashboardDestination", () => {
  it("recognizes scenarios", () => {
    expect(detectDashboardDestination("scénarios")?.key).toBe("scenarios");
    expect(detectDashboardDestination("les scénarios")?.route).toBe("/catalog");
  });

  it("recognizes the quiz", () => {
    expect(detectDashboardDestination("je veux faire le quiz")?.key).toBe("quiz");
    expect(detectDashboardDestination("le quiz")?.route).toBe("/quiz");
  });

  it("recognizes the daily challenge", () => {
    expect(detectDashboardDestination("défi du jour")?.key).toBe("dailyChallenge");
    expect(detectDashboardDestination("défi du jour")?.route).toBe("/defi-du-jour");
  });

  it("recognizes progress", () => {
    expect(detectDashboardDestination("ma progression")?.key).toBe("progress");
    expect(detectDashboardDestination("ma progression")?.route).toBe("/trophees");
  });

  it("recognizes badges", () => {
    expect(detectDashboardDestination("mes badges")?.key).toBe("badges");
    expect(detectDashboardDestination("mes badges")?.route).toBe("/badges");
  });

  it("recognizes trophies", () => {
    expect(detectDashboardDestination("mes trophées")?.key).toBe("trophies");
    expect(detectDashboardDestination("mes trophées")?.route).toBe("/trophees");
  });

  it("recognizes the profile", () => {
    expect(detectDashboardDestination("mon profil")?.key).toBe("profile");
    expect(detectDashboardDestination("mon profil")?.route).toBe("/mon-compte");
  });

  it("gives progress and trophies distinct confirmation lines despite sharing a route", () => {
    const progress = detectDashboardDestination("ma progression");
    const trophies = detectDashboardDestination("mes trophées");
    expect(progress?.route).toBe(trophies?.route);
    expect(progress?.confirmSpeech).not.toBe(trophies?.confirmSpeech);
  });

  it("returns null for an ambiguous phrase", () => {
    expect(detectDashboardDestination("je veux travailler un peu")).toBeNull();
  });

  it("returns null for a negated request instead of matching the negated word", () => {
    expect(detectDashboardDestination("je ne veux pas faire le quiz")).toBeNull();
  });

  it("returns null for an empty transcript", () => {
    expect(detectDashboardDestination("")).toBeNull();
  });
});
