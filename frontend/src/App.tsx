import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CatalogPage } from "./pages/CatalogPage";
import { SessionPage } from "./pages/SessionPage";
import { QuizPage } from "./pages/QuizPage";
import { QuizModulePage } from "./pages/QuizModulePage";
import { BadgesPage } from "./pages/BadgesPage";
import { TrophiesPage } from "./pages/TrophiesPage";
import { RequireAuth } from "./components/RequireAuth";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
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
      </Routes>
    </BrowserRouter>
  );
}
