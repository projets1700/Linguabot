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

export type QuizModule = {
  id: number;
  code: string;
  title: string;
  questionCount: number;
  passed: boolean;
};

export type QuizQuestion = {
  id: number;
  questionText: string;
};

export type QuizAttemptResult = {
  score: number;
  passed: boolean;
  xpEarned: number;
  levelUp: boolean;
  userLevel: string;
  userTotalXp: number;
};

export type SessionMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

export type SessionDetail = {
  id: number;
  status: "in_progress" | "completed" | "abandoned";
  scenario: {
    id: number;
    title: string;
    characterName: string;
  };
  messages: SessionMessage[];
};

export type SessionFinishResult = {
  score: number;
  xpEarned: number;
  userTotalXp: number;
  userSessionsCount: number;
};
