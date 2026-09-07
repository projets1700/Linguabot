import { describe, expect, it } from "vitest";
import { classifyVoiceGender, groupEnglishVoicesByGender } from "./voices";

function fakeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return {
    name,
    lang,
    voiceURI: name,
    default: false,
    localService: true,
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

  it("falls back to neutral for unrecognised names rather than guessing", () => {
    expect(classifyVoiceGender(fakeVoice("Google US English", "en-US"))).toBe("neutral");
  });
});

describe("groupEnglishVoicesByGender", () => {
  it("filters out non-English voices", () => {
    const voices = [fakeVoice("Microsoft Zira Desktop", "en-US"), fakeVoice("Microsoft Hortense", "fr-FR")];

    const grouped = groupEnglishVoicesByGender(voices);

    expect(grouped.female).toHaveLength(1);
    expect(grouped.male).toHaveLength(0);
    expect(grouped.neutral).toHaveLength(0);
  });

  it("caps each gender category at 3 voices", () => {
    const voices = [
      fakeVoice("David", "en-US"),
      fakeVoice("Mark", "en-US"),
      fakeVoice("Guy", "en-US"),
      fakeVoice("Christopher", "en-US"),
    ];

    const grouped = groupEnglishVoicesByGender(voices);

    expect(grouped.male).toHaveLength(3);
  });
});
