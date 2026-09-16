import { Link } from "react-router-dom";
import { Card } from "../ui/Card";

type Props = {
  sessionsCount: number;
};

/**
 * Deliberately shows NONE of A1/A2/level-code/XP/progress bar - all of that
 * already lives in the Dashboard's own hero card. Was briefly showing
 * user.avgScore ("Score moyen") too, removed after auditing its source:
 * SessionController's own comment states it's "simulated scoring" -
 * literally just 40 + userTurns*15, not a real linguistic measure - so
 * presenting it as a quality/skill metric would be showing a made-up
 * statistic, not a real one.
 */
export function ProgressCard({ sessionsCount }: Props) {
  return (
    <Card variant="stat" className="border border-blue-500/15 flex flex-col justify-center">
      <p className="text-blue-400 text-xs font-bold uppercase mb-2">📊 Your progress</p>
      <p className="text-lg font-bold mb-0.5">
        {sessionsCount} session{sessionsCount > 1 ? "s" : ""} completed
      </p>
      <p className="text-slate-400 text-sm mb-4">Check out your unlocked badges and trophies.</p>
      <Link to="/trophees" className="text-blue-400 text-sm">See my progress →</Link>
    </Card>
  );
}
