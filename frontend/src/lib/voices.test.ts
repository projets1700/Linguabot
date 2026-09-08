import { describe, expect, it } from "vitest";
import { classifyVoiceGender, groupEnglishVoicesByGender, pickVoiceForGender } from "./voices";

function fakeVoice(name: string, lang: string, localService = true): SpeechSynthesisVoice {
  return {
    name,
    lang,
    voiceURI: name,
    default: false,
    localService,
  } as SpeechSynthesisVoice;
}

describe("classifyVoiceGender", () => {
  it("recognises common female voice names", () => {
    expect(classifyVoiceGender(fakeVoice("Microsoft Zira Desktop", "en-US"))).toBe("female");
    expect(classifyVoiceGender(fakeVoice("Google UK English Female", "en-GB"))).toBe("female");
  });

  it("recognises common male voice names", () => {
    expect(classifyVoiceGender(fakeVoice("Microsoft David Desktop", "en-US"))).toBe("male");
    expect(classifyVoiceGender(fakeVoice("Google UK English Male", "en-GB"))).toBe("male");
  });

  it("recognises common French voice names", () => {
    expect(classifyVoiceGender(fakeVoice("Microsoft Hortense Desktop", "fr-FR"))).toBe("female");
    expect(classifyVoiceGender(fakeVoice("Microsoft Henri Online (Natural)", "fr-FR"))).toBe("male");
  });

  it("falls back to female for unrecognised names rather than a third category", () => {
    expect(classifyVoiceGender(fakeVoice("Google US English", "en-US"))).toBe("female");
  });
});

describe("groupEnglishVoicesByGender", () => {
  it("filters out non-English voices", () => {
    const voices = [fakeVoice("Microsoft Zira Desktop", "en-US"), fakeVoice("Microsoft Hortense", "fr-FR")];

    const grouped = groupEnglishVoicesByGender(voices);

    expect(grouped.female).toHaveLength(1);
    expect(grouped.male).toHaveLength(0);
  });

  it("caps male at 3 voices", () => {
    const voices = [
      fakeVoice("David", "en-US"),
      fakeVoice("Mark", "en-US"),
      fakeVoice("Guy", "en-US"),
      fakeVoice("Christopher", "en-US"),
    ];

    const grouped = groupEnglishVoicesByGender(voices);

    expect(grouped.male).toHaveLength(3);
  });

  it("caps female at 6, since it also absorbs unrecognised names", () => {
    const voices = [
      fakeVoice("Zira", "en-US"),
      fakeVoice("Aria", "en-US"),
      fakeVoice("Jenny", "en-US"),
      fakeVoice("Google US English", "en-US"),
      fakeVoice("Google UK English", "en-US"),
      fakeVoice("Ivy", "en-US"),
      fakeVoice("Salma", "en-US"),
    ];

    const grouped = groupEnglishVoicesByGender(voices);

    expect(grouped.female).toHaveLength(6);
  });
});

describe("pickVoiceForGender", () => {
  it("finds a voice matching both the language prefix and the gender", () => {
    const voices = [
      fakeVoice("Microsoft Denise Online (Natural)", "fr-FR"),
      fakeVoice("Microsoft Henri Online (Natural)", "fr-FR"),
      fakeVoice("Microsoft Zira Desktop", "en-US"),
    ];

    expect(pickVoiceForGender(voices, "fr", "male")?.name).toBe("Microsoft Henri Online (Natural)");
    expect(pickVoiceForGender(voices, "fr", "female")?.name).toBe("Microsoft Denise Online (Natural)");
  });

  it("returns null when no voice matches the language prefix", () => {
    const voices = [fakeVoice("Microsoft Zira Desktop", "en-US")];

    expect(pickVoiceForGender(voices, "fr", "male")).toBeNull();
  });

  it("prefers a local voice over a network one when both match", () => {
    // Regression: an auto-picked network ("Online (Natural)") voice
    // doesn't reliably fire the "boundary" event lip-sync depends on,
    // silently degrading it - a local voice is the safer default.
    const networkVoice = fakeVoice("Microsoft Guy Online (Natural)", "en-US", false);
    const localVoice = fakeVoice("Microsoft David Desktop", "en-US", true);
    const voices = [networkVoice, localVoice];

    expect(pickVoiceForGender(voices, "en", "male")).toBe(localVoice);
  });

  it("falls back to a network voice if no local one matches", () => {
    const networkVoice = fakeVoice("Microsoft Guy Online (Natural)", "en-US", false);

    expect(pickVoiceForGender([networkVoice], "en", "male")).toBe(networkVoice);
  });
});
