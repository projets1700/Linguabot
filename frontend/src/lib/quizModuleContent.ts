// Purely presentational - icon/description per module, keyed by the real,
// stable module code (QuizFixtures), never by the French title text. A
// module code with no entry here (e.g. a future 7th module) still renders
// with a generic fallback rather than breaking.
const QUIZ_MODULE_CONTENT: Record<string, { icon: string; description: string }> = {
  "M0-1": { icon: "👋", description: "Dire bonjour et se présenter" },
  "M0-2": { icon: "🔢", description: "Nombres et quantités" },
  "M0-3": { icon: "🎨", description: "Les couleurs essentielles" },
  "M0-4": { icon: "👨‍👩‍👧", description: "Parler de ses proches" },
  "M0-5": { icon: "🍎", description: "Aliments et boissons" },
  "M0-6": { icon: "🎒", description: "Objets du quotidien" },
};

export function quizModuleIcon(code: string): string {
  return QUIZ_MODULE_CONTENT[code]?.icon ?? "📘";
}

export function quizModuleDescription(code: string): string {
  return QUIZ_MODULE_CONTENT[code]?.description ?? "";
}
