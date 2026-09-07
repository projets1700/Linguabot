import { create } from "zustand";

const STORAGE_KEY = "linguabot_voice_uri";

type VoiceSettingsState = {
  selectedVoiceURI: string | null;
  setSelectedVoiceURI: (uri: string | null) => void;
};

export const useVoiceSettingsStore = create<VoiceSettingsState>((set) => ({
  selectedVoiceURI: localStorage.getItem(STORAGE_KEY),

  setSelectedVoiceURI(uri) {
    if (uri) {
      localStorage.setItem(STORAGE_KEY, uri);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ selectedVoiceURI: uri });
  },
}));
