import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AppProvider, useApp } from './context/AppContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ErrorBoundary, FabDock, ScrollProgress, ScrollToTop } from './components/Chrome';
import { Spinner } from './components/ui';
import type { Role } from './types';

const HomePage = lazy(() => import('./pages/HomePage'));
const ConferencesPage = lazy(() => import('./pages/ConferencesPage'));
const ConferenceDetailPage = lazy(() => import('./pages/ConferenceDetailPage'));
const TicketPage = lazy(() => import('./pages/TicketPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const AdminLoginPage = lazy(() => import('./pages/auth/AdminLoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const DashboardPage = lazy(() => import('./pages/organizer/DashboardPage'));
const MyConferencesPage = lazy(() => import('./pages/organizer/MyConferencesPage'));
const ConferenceEditorPage = lazy(() => import('./pages/organizer/ConferenceEditorPage'));
const AttendeesPage = lazy(() => import('./pages/organizer/AttendeesPage'));
const CheckInPage = lazy(() => import('./pages/organizer/CheckInPage'));
const AnalyticsPage = lazy(() => import('./pages/organizer/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/organizer/SettingsPage'));
const HelpPage = lazy(() => import('./pages/organizer/HelpPage'));

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminOrganizersPage = lazy(() => import('./pages/admin/AdminOrganizersPage'));
const AdminConferencesPage = lazy(() => import('./pages/admin/AdminConferencesPage'));
const AdminFeedbackPage = lazy(() => import('./pages/admin/AdminFeedbackPage'));
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage'));

export const HOME_OF: Record<Role, string> = { organizer: '/dashboard', admin: '/admin' };

/** Only the given role may open the page. Others go to their own dashboard; visitors go to sign in. */
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { token, role: current, t } = useApp();
  const location = useLocation();
  const wrongRole = Boolean(token && current && current !== role);
  useEffect(() => {
    if (wrongRole) toast.error(t('not_allowed'), { id: 'not-allowed' });
  }, [wrongRole, t]);
  if (!token || !current) {
    return <Navigate to={role === 'admin' ? '/admin/login' : '/login'} replace state={{ from: location.pathname + location.search }} />;
  }
  if (wrongRole) return <Navigate to={HOME_OF[current]} replace />;
  return <>{children}</>;
}

/** Sign-in pages: someone already signed in goes straight to their dashboard. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { token, role } = useApp();
  if (token && role) return <Navigate to={HOME_OF[role]} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  const { lang } = useApp();
  return (
    <>
      <ScrollProgress />
      <ScrollToTop />
      <Navbar />
      <main className="app-main" id="main">
        <ErrorBoundary lang={lang}>
          <Suspense fallback={<Spinner />}>
            <div key={location.pathname} className="page-enter">
              <Routes location={location}>
                <Route path="/" element={<HomePage />} />
                <Route path="/conferences" element={<ConferencesPage />} />
                <Route path="/conferences/:id" element={<ConferenceDetailPage />} />
                <Route path="/tickets/:code" element={<TicketPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />

                <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
                <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
                <Route path="/admin/login" element={<GuestOnly><AdminLoginPage /></GuestOnly>} />
                <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
                <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />
                <Route path="/verify-email" element={<GuestOnly><VerifyEmailPage /></GuestOnly>} />

                <Route path="/dashboard" element={<RequireRole role="organizer"><DashboardPage /></RequireRole>} />
                <Route path="/my-conferences" element={<RequireRole role="organizer"><MyConferencesPage /></RequireRole>} />
                <Route path="/my-conferences/new" element={<RequireRole role="organizer"><ConferenceEditorPage /></RequireRole>} />
                <Route path="/my-conferences/:id/edit" element={<RequireRole role="organizer"><ConferenceEditorPage /></RequireRole>} />
                <Route path="/attendees/:confId" element={<RequireRole role="organizer"><AttendeesPage /></RequireRole>} />
                <Route path="/check-in" element={<RequireRole role="organizer"><CheckInPage /></RequireRole>} />
                <Route path="/check-in/:confId" element={<RequireRole role="organizer"><CheckInPage /></RequireRole>} />
                <Route path="/analytics" element={<RequireRole role="organizer"><AnalyticsPage /></RequireRole>} />
                <Route path="/settings" element={<RequireRole role="organizer"><SettingsPage /></RequireRole>} />
                <Route path="/help" element={<RequireRole role="organizer"><HelpPage /></RequireRole>} />

                <Route path="/admin" element={<RequireRole role="admin"><AdminDashboardPage /></RequireRole>} />
                <Route path="/admin/organizers" element={<RequireRole role="admin"><AdminOrganizersPage /></RequireRole>} />
                <Route path="/admin/conferences" element={<RequireRole role="admin"><AdminConferencesPage /></RequireRole>} />
                <Route path="/admin/feedback" element={<RequireRole role="admin"><AdminFeedbackPage /></RequireRole>} />
                <Route path="/admin/activity" element={<RequireRole role="admin"><AdminActivityPage /></RequireRole>} />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <FabDock />
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
