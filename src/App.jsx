import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { IntroProvider } from './intro/IntroContext.jsx';
import { I18nProvider } from './i18n/I18nContext.jsx';
import Layout from './components/Layout.jsx';
import { DashboardRedirect, PublicOnly, RequireAdmin, RequireAuth, RequireStaff } from './components/Guards.jsx';
import { Spinner } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import NotFound from './pages/NotFound.jsx';
import Login from './pages/auth/Login.jsx';
import Signup from './pages/auth/Signup.jsx';
import VerifyEmail from './pages/auth/VerifyEmail.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import FamilyHome from './pages/parent/FamilyHome.jsx';
import ChildDetail from './pages/parent/ChildDetail.jsx';
import ChildFormPage from './pages/parent/ChildFormPage.jsx';
import AccountSettings from './pages/AccountSettings.jsx';

// Staff and admin screens are only downloaded by staff.
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard.jsx'));
const StudentDetail = lazy(() => import('./pages/staff/StudentDetail.jsx'));
const AttendancePage = lazy(() => import('./pages/staff/AttendancePage.jsx'));
const ActivityPage = lazy(() => import('./pages/staff/ActivityPage.jsx'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage.jsx'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage.jsx'));

export default function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <IntroProvider>
            <Layout>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />

                <Route path="/dashboard" element={<RequireAuth><DashboardRedirect /></RequireAuth>} />
                <Route path="/settings" element={<RequireAuth><AccountSettings /></RequireAuth>} />
                <Route path="/profile" element={<Navigate to="/settings" replace />} />
                <Route path="/family" element={<RequireAuth><FamilyHome /></RequireAuth>} />
                <Route path="/family/add" element={<RequireAuth><ChildFormPage mode="create" /></RequireAuth>} />
                <Route path="/family/:studentId" element={<RequireAuth><ChildDetail /></RequireAuth>} />
                <Route path="/family/:studentId/edit" element={<RequireAuth><ChildFormPage mode="edit" /></RequireAuth>} />

                <Route path="/staff" element={<RequireStaff><StaffDashboard /></RequireStaff>} />
                <Route path="/staff/students/:studentId" element={<RequireStaff><StudentDetail /></RequireStaff>} />
                <Route path="/staff/students/:studentId/edit" element={<RequireStaff><ChildFormPage mode="edit" staff /></RequireStaff>} />
                <Route path="/staff/attendance" element={<RequireStaff><AttendancePage /></RequireStaff>} />
                <Route path="/staff/activity" element={<RequireStaff><ActivityPage /></RequireStaff>} />

                <Route path="/admin/users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
                <Route path="/admin/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </Layout>
          </IntroProvider>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
    </I18nProvider>
  );
}
