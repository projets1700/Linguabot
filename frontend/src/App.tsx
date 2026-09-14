import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PlacementTestPage } from "./pages/PlacementTestPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CatalogPage } from "./pages/CatalogPage";
import { SessionPage } from "./pages/SessionPage";
import { QuizPage } from "./pages/QuizPage";
import { QuizModulePage } from "./pages/QuizModulePage";
import { BadgesPage } from "./pages/BadgesPage";
import { TrophiesPage } from "./pages/TrophiesPage";
import { DailyChallengePage } from "./pages/DailyChallengePage";
import { VoiceSettingsPage } from "./pages/VoiceSettingsPage";
import { AccountPage } from "./pages/AccountPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminScenariosPage } from "./pages/admin/AdminScenariosPage";
import { AdminChallengesPage } from "./pages/admin/AdminChallengesPage";
import { AdminGamificationPage } from "./pages/admin/AdminGamificationPage";
import { AdminLogsPage } from "./pages/admin/AdminLogsPage";
import { RequireAuth } from "./components/RequireAuth";
import { RequireAdmin } from "./components/RequireAdmin";
import { ToastViewport } from "./components/ui/Toast";

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Audit C6: one RequireAuth guard per protected route used to be
            repeated at every single Route below - a layout route runs the
            guard once and renders whichever child route matched via
            Outlet, same runtime behavior, far fewer places to forget it. */}
        <Route element={<RequireAuth><Outlet /></RequireAuth>}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/placement-test" element={<PlacementTestPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/quiz/:moduleId" element={<QuizModulePage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
          <Route path="/badges" element={<BadgesPage />} />
          <Route path="/trophees" element={<TrophiesPage />} />
          <Route path="/defi-du-jour" element={<DailyChallengePage />} />
          <Route path="/voix" element={<VoiceSettingsPage />} />
          <Route path="/mon-compte" element={<AccountPage />} />

          <Route element={<RequireAdmin><Outlet /></RequireAdmin>}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/utilisateurs" element={<AdminUsersPage />} />
            <Route path="/admin/scenarios" element={<AdminScenariosPage />} />
            <Route path="/admin/defis" element={<AdminChallengesPage />} />
            <Route path="/admin/gamification" element={<AdminGamificationPage />} />
            <Route path="/admin/logs" element={<AdminLogsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <ToastViewport />
    </>
  );
}
