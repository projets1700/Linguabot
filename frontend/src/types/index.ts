export type Level = {
  code: string;
  name: string;
  xpThreshold: number;
};

export type AvatarType = "male" | "female";

export type Me = {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  role: "ROLE_USER" | "ROLE_ADMIN";
  level: Level;
  avatarType: AvatarType;
  totalXp: number;
  sessionsCount: number;
  avgScore: string | null;
  onboardingCompleted: boolean;
  placementTestCompleted: boolean;
  cecrlProfile: CecrlProfile;
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
  locked: boolean;
};

export type LevelUpResult = {
  code: string;
  name: string;
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

/**
 * How much help a learner gets by default, resolved server-side from their
 * CECRL level (CecrlProfileService::publicPayload). Aids not shown by
 * default (e.g. translation for a B2 learner) stay reachable manually -
 * this only shapes what's surfaced up front, see HelpPanel.
 */
export type CecrlProfile = {
  transcriptMode: "auto" | "available" | "onDemand";
  translationMode: "visible" | "onDemand" | "rare";
  // How "Je suis bloqué ?" behaves: fullAnswer (A0/A1) gives the complete
  // example sentence directly, for the learner to repeat aloud; keywords
  // (A2/B1) gives only key words, nothing more; progressive (B2) keeps the
  // original 3-tier ladder (keywords -> sentence starter -> full example).
  hintMode: "fullAnswer" | "keywords" | "progressive";
  // Whether the help panel/reveal is offered unprompted (A0-A2) or only
  // once the learner explicitly signals they're stuck (B1/B2) - see
  // detectLearnerBlock and each caller's own helpUnlocked state.
  helpVisibleByDefault: boolean;
};

export type SessionDetail = {
  id: number;
  status: "in_progress" | "completed" | "abandoned";
  scenario: {
    id: number;
    title: string;
    characterName: string;
  };
  cecrlProfile: CecrlProfile;
  messages: SessionMessage[];
  // Present once the session is finished and a bilan was persisted - lets a
  // learner who refreshes or revisits a completed session still see it.
  // Null for a session still in progress, or one finished before this field
  // existed.
  summary: SessionSummary | null;
};

export type PlacementTestDetail = {
  id: number;
  status: "in_progress" | "completed" | "abandoned";
  totalQuestions: number;
  answeredCount: number;
  messages: SessionMessage[];
};

export type PlacementTestMessageResult = {
  userTranscript: string;
  assistantMessage: string;
  answeredCount: number;
  totalQuestions: number;
  readyToFinish: boolean;
};

export type PlacementTestFinishResult = {
  level: {
    code: string;
    name: string;
  };
};

/**
 * The qualitative + objective end-of-session bilan (SessionSummaryService).
 * No numeric/phonetic score anywhere on purpose - see backend comments.
 */
export type SessionSummary = {
  summary: string;
  exchangeCount: number;
  xpEarned: number;
  status: "completed";
  scenarioTitle: string;
  strengths: string[];
  reviewPoints: string[];
  usefulExpressions: string[];
  nextStep: string;
};

export type SessionFinishResult = {
  score: number;
  xpEarned: number;
  userTotalXp: number;
  userSessionsCount: number;
  levelUp: LevelUpResult | null;
  newBadges: EarnedBadge[];
  newTrophies: EarnedTrophy[];
  summary: SessionSummary;
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

export type DailyChallenge = {
  id: number;
  title: string;
  context: string;
  objective: string;
  keywords: string[];
  characterName: string;
  challengeDate: string;
  xpReward: number;
  started: boolean;
  completed: boolean;
  cecrlProfile: CecrlProfile;
};

export type DailyChallengeFinishResult = {
  xpEarned: number;
  userTotalXp: number;
  levelUp: LevelUpResult | null;
  newBadges: EarnedBadge[];
  newTrophies: EarnedTrophy[];
};

export type AdminUser = {
  id: number;
  prenom: string;
  nom: string;
  email: string;
  role: "ROLE_USER" | "ROLE_ADMIN";
  level: string;
  totalXp: number;
  sessionsCount: number;
  isActive: boolean;
  createdAt: string;
};

export type AdminScenario = {
  id: number;
  code: string;
  title: string;
  level: string;
  category: "quotidien" | "thematique";
  characterName: string;
  baseXp: number;
  playCount: number;
  isActive: boolean;
};

export type AdminDailyChallenge = {
  id: number;
  level: string;
  title: string;
  context: string;
  objective: string;
  keywords: string[];
  characterName: string;
  challengeDate: string;
};

export type AdminBadge = {
  id: number;
  code: string;
  name: string;
  conditionType: string;
  conditionValue: number;
  xpBonus: number;
  isActive: boolean;
};

export type AdminTrophy = {
  id: number;
  code: string;
  name: string;
  conditionType: string;
  conditionValue: number;
  xpReward: number;
  rarity: string;
};

export type AdminLog = {
  id: number;
  admin: string;
  action: string;
  targetType: string | null;
  targetId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminStats = {
  usersCount: number;
  scenariosCount: number;
  sessionsCount: number;
  completedSessionsCount: number;
  completionRate: number;
  avgScoreGlobal: number | null;
  levelDistribution: { level: string; count: number }[];
  topScenarios: { code: string; title: string; playCount: number }[];
  sessionsByDay: { day: string; count: number }[];
  challengeParticipationRate: number;
  xpDistributedToday: number;
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
