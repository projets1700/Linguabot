import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CatalogPage } from "./pages/CatalogPage";
import { SessionPage } from "./pages/SessionPage";
import { QuizPage } from "./pages/QuizPage";
import { QuizModulePage } from "./pages/QuizModulePage";
import { BadgesPage } from "./pages/BadgesPage";
import { TrophiesPage } from "./pages/TrophiesPage";
import { DailyChallengePage } from "./pages/DailyChallengePage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminScenariosPage } from "./pages/admin/AdminScenariosPage";
import { AdminChallengesPage } from "./pages/admin/AdminChallengesPage";
import { AdminGamificationPage } from "./pages/admin/AdminGamificationPage";
import { AdminLogsPage } from "./pages/admin/AdminLogsPage";
import { RequireAuth } from "./components/RequireAuth";
import { RequireAdmin } from "./components/RequireAdmin";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/catalog"
          element={
            <RequireAuth>
              <CatalogPage />
            </RequireAuth>
          }
        />
        <Route
          path="/quiz"
          element={
            <RequireAuth>
              <QuizPage />
            </RequireAuth>
          }
        />
        <Route
          path="/quiz/:moduleId"
          element={
            <RequireAuth>
              <QuizModulePage />
            </RequireAuth>
          }
        />
        <Route
          path="/sessions/:id"
          element={
            <RequireAuth>
              <SessionPage />
            </RequireAuth>
          }
        />
        <Route
          path="/badges"
          element={
            <RequireAuth>
              <BadgesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/trophees"
          element={
            <RequireAuth>
              <TrophiesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/defi-du-jour"
          element={
            <RequireAuth>
              <DailyChallengePage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminDashboardPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/utilisateurs"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminUsersPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/scenarios"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminScenariosPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/defis"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminChallengesPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/gamification"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminGamificationPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <RequireAuth>
              <RequireAdmin>
                <AdminLogsPage />
              </RequireAdmin>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
