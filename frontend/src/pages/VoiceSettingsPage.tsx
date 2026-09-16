import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadVoices, groupEnglishVoicesByGender, type GroupedVoices } from "../lib/voices";
import { speakText } from "../lib/speech";
import { useAuthStore } from "../stores/authStore";
import { useVoiceSettingsStore } from "../stores/voiceSettingsStore";

const PREVIEW_TEXT = "Hello! I'm your English conversation partner. Nice to meet you!";

const CATEGORY_LABELS: Record<keyof GroupedVoices, string> = {
  male: "Male voice",
  female: "Female voice",
};

export function VoiceSettingsPage() {
  // The avatar chosen at registration decides the gender of voice on offer
  // here - a male avatar shouldn't be paired with a female voice or vice
  // versa, so this page no longer lets the two mix.
  const avatarType = useAuthStore((state) => state.user?.avatarType) ?? "male";

  const [grouped, setGrouped] = useState<GroupedVoices>({ male: [], female: [] });
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const selectedVoiceURI = useVoiceSettingsStore((state) => state.selectedVoiceURI);
  const setSelectedVoiceURI = useVoiceSettingsStore((state) => state.setSelectedVoiceURI);

  useEffect(() => {
    loadVoices().then((voices) => {
      setGrouped(groupEnglishVoicesByGender(voices));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading) return;

    // A voice picked before this male/female restriction existed (or while
    // testing a different avatarType) could still be the wrong gender for
    // the current avatar - clear it rather than silently keep speaking
    // with a mismatched voice.
    const stillValid = grouped[avatarType].some((voice) => voice.voiceURI === selectedVoiceURI);
    if (selectedVoiceURI && !stillValid) {
      setSelectedVoiceURI(null);
    }
  }, [avatarType, grouped, loading, selectedVoiceURI, setSelectedVoiceURI]);

  function handlePreview(voiceURI: string) {
    setPreviewing(voiceURI);
    speakText(PREVIEW_TEXT, {
      voiceURI,
      onEnd: () => setPreviewing(null),
    });
  }

  const availableVoices = grouped[avatarType];
  const hasAnyVoice = availableVoices.length > 0;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">🔊 AI Voice</h1>
        <Link to="/dashboard" className="text-sm text-slate-400 hover:text-white">
          Back to dashboard
        </Link>
      </div>

      <p className="text-slate-400 mb-8 max-w-2xl">
        Choose the voice used during sessions, the daily challenge, the placement test and the
        vocabulary test. The voices on offer match the avatar chosen at sign-up (
        {CATEGORY_LABELS[avatarType].toLowerCase()}).
      </p>

      {loading && <p className="text-slate-400">Loading available voices...</p>}

      {!loading && !hasAnyVoice && (
        <p className="text-slate-400">
          No English voice of this type detected on this device. The AI will use the browser's
          default voice.
        </p>
      )}

      {!loading && hasAnyVoice && (
        <div className="max-w-md mb-8">
          <div className="bg-slate-900 p-6 rounded-xl">
            <h2 className="text-lg font-semibold mb-4">{CATEGORY_LABELS[avatarType]}</h2>

            <div className="flex flex-col gap-3">
              {availableVoices.map((voice) => {
                const isSelected = selectedVoiceURI === voice.voiceURI;
                return (
                  <div
                    key={voice.voiceURI}
                    className={`flex items-center justify-between gap-2 p-3 rounded-lg border ${
                      isSelected ? "border-blue-500 bg-slate-800" : "border-slate-700"
                    }`}
                  >
                    <span className="text-left text-sm flex-1">{voice.name}</span>
                    <button
                      type="button"
                      onClick={() => handlePreview(voice.voiceURI)}
                      disabled={previewing === voice.voiceURI}
                      className="text-xs bg-slate-700 px-2 py-1 rounded hover:bg-slate-600 disabled:opacity-50"
                    >
                      {previewing === voice.voiceURI ? "..." : "Listen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedVoiceURI(voice.voiceURI)}
                      disabled={isSelected}
                      className={`text-xs px-2 py-1 rounded font-semibold disabled:opacity-100 ${
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-700 hover:bg-slate-600"
                      }`}
                    >
                      {isSelected ? "✓ Selected" : "Choose"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
