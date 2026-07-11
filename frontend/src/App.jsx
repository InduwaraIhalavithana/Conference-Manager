import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import Navbar from "./components/Navbar";
import "./PageTransition.css";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import UpcomingConferencesPage from "./pages/UpcomingConferencesPage";
import ConferenceDetailPage from "./pages/ConferenceDetailPage";
import DashboardPage from "./pages/DashboardPage";
import ManageConferencesPage from "./pages/ManageConferencesPage";
import AttendeesPage from "./pages/AttendeesPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminOrganizersPage from "./pages/admin/AdminOrganizersPage";
import AdminConferencesPage from "./pages/admin/AdminConferencesPage";
import AdminFeedbackPage from "./pages/admin/AdminFeedbackPage";
import AdminActivityPage from "./pages/admin/AdminActivityPage";
import NotFoundPage from "./pages/NotFoundPage";

function OrganizerRoute({ children }) {
  const { token, role } = useApp();
  if (!token || role !== "organizer") return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { token, role } = useApp();
  if (!token || role !== "admin") return <Navigate to="/admin/login" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <>
      <Navbar />
      <div key={location.pathname} className="page-transition">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/conferences" element={<UpcomingConferencesPage />} />
        <Route path="/conferences/:id" element={<ConferenceDetailPage />} />

        <Route path="/dashboard" element={<OrganizerRoute><DashboardPage /></OrganizerRoute>} />
        <Route path="/my-conferences" element={<OrganizerRoute><ManageConferencesPage /></OrganizerRoute>} />
        <Route path="/attendees/:confId" element={<OrganizerRoute><AttendeesPage /></OrganizerRoute>} />
        <Route path="/settings" element={<OrganizerRoute><SettingsPage /></OrganizerRoute>} />
        <Route path="/help" element={<OrganizerRoute><HelpPage /></OrganizerRoute>} />

        <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/admin/organizers" element={<AdminRoute><AdminOrganizersPage /></AdminRoute>} />
        <Route path="/admin/conferences" element={<AdminRoute><AdminConferencesPage /></AdminRoute>} />
        <Route path="/admin/feedback" element={<AdminRoute><AdminFeedbackPage /></AdminRoute>} />
        <Route path="/admin/activity" element={<AdminRoute><AdminActivityPage /></AdminRoute>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
