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
  newBadges: EarnedBadge[];
  newTrophies: EarnedTrophy[];
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
  newBadges: EarnedBadge[];
  newTrophies: EarnedTrophy[];
};

export type EarnedBadge = {
  code: string;
  name: string;
  icon: string | null;
};

export type EarnedTrophy = {
  code: string;
  name: string;
  rarity: "bronze" | "silver" | "gold" | "platinum";
};

export type Badge = {
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  xpBonus: number;
  earned: boolean;
};

export type Trophy = {
  code: string;
  name: string;
  description: string | null;
  rarity: "bronze" | "silver" | "gold" | "platinum";
  xpReward: number;
  progressCurrent: number;
  progressTotal: number;
  earned: boolean;
};
