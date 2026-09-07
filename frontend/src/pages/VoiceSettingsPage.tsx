import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadVoices, groupEnglishVoicesByGender, type GroupedVoices } from "../lib/voices";
import { speakText } from "../lib/speech";
import { useVoiceSettingsStore } from "../stores/voiceSettingsStore";

const PREVIEW_TEXT = "Hello! I'm your English conversation partner. Nice to meet you!";

const CATEGORY_LABELS: Record<keyof GroupedVoices, string> = {
  male: "Voix homme",
  female: "Voix femme",
  neutral: "Voix neutre",
};

export function VoiceSettingsPage() {
  const [grouped, setGrouped] = useState<GroupedVoices>({ male: [], female: [], neutral: [] });
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

  function handlePreview(voiceURI: string) {
    setPreviewing(voiceURI);
    speakText(PREVIEW_TEXT, {
      voiceURI,
      onEnd: () => setPreviewing(null),
    });
  }

  const hasAnyVoice = grouped.male.length + grouped.female.length + grouped.neutral.length > 0;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">🔊 Voix de l'IA</h1>
        <Link to="/dashboard" className="text-sm text-slate-400 hover:text-white">
          Retour au dashboard
        </Link>
      </div>

      <p className="text-slate-400 mb-8 max-w-2xl">
        Choisis la voix utilisée pendant les sessions, le défi du jour et le test de niveau.
        Ce choix ne change pas la voix du quiz A0, qui reste en français.
      </p>

      {loading && <p className="text-slate-400">Chargement des voix disponibles...</p>}

      {!loading && !hasAnyVoice && (
        <p className="text-slate-400">
          Aucune voix anglaise détectée sur cet appareil. L'IA utilisera la voix par défaut du
          navigateur.
        </p>
      )}

      {!loading && hasAnyVoice && (
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {(Object.keys(grouped) as (keyof GroupedVoices)[]).map((category) => (
            <div key={category} className="bg-slate-900 p-6 rounded-xl">
              <h2 className="text-lg font-semibold mb-4">{CATEGORY_LABELS[category]}</h2>

              {grouped[category].length === 0 && (
                <p className="text-slate-500 text-sm">Aucune voix de ce type sur cet appareil.</p>
              )}

              <div className="flex flex-col gap-3">
                {grouped[category].map((voice) => {
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
                        {previewing === voice.voiceURI ? "..." : "Écouter"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedVoiceURI(voice.voiceURI)}
                        disabled={isSelected}
                        className={`text-xs px-2 py-1 rounded font-semibold disabled:opacity-100 ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 hover:bg-slate-600"
                        }`}
                      >
                        {isSelected ? "✓ Sélectionné" : "Choisir"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSelectedVoiceURI(null)}
        className="text-sm text-slate-400 underline hover:text-slate-300"
      >
        Revenir à la voix par défaut du navigateur
      </button>
    </main>
  );
}
