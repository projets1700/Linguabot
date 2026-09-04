export type Level = {
  code: string;
  name: string;
  xpThreshold: number;
};

export type Me = {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  role: "ROLE_USER" | "ROLE_ADMIN";
  level: Level;
  totalXp: number;
  sessionsCount: number;
  avgScore: string | null;
};

export type Scenario = {
  id: number;
  code: string;
  title: string;
  context: string;
  level: string;
  category: "quotidien" | "thematique";
  characterName: string;
  durationEstimate: number;
  baseXp: number;
};
