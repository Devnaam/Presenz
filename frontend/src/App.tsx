import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Conversations from './pages/Conversations';
import Contacts from './pages/Contacts';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import Profile from './pages/Profile';
import Activity from './pages/Activity';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';   // ✅ NEW — public page


// ─────────────────────────────────────────────────────────────────
// LandingOrDashboard
// Root route — shows Landing to guests, redirects logged-in users
// ─────────────────────────────────────────────────────────────────
const LandingOrDashboard: React.FC = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
};


// ─────────────────────────────────────────────────────────────────
// OnboardingGuard
// Blocks access to dashboard-level routes until onboarding is done.
// Reads localStorage directly (sync) — React state is async and
// hasn't updated yet right after navigate() in Login.tsx
// ─────────────────────────────────────────────────────────────────
const OnboardingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const flag = localStorage.getItem('onboardingComplete') === 'true';
  if (!flag) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};


// ─────────────────────────────────────────────────────────────────
// OnboardingRoute
// Prevents users who already completed onboarding from re-entering
// ─────────────────────────────────────────────────────────────────
const OnboardingRoute: React.FC = () => {
  const flag = localStorage.getItem('onboardingComplete') === 'true';
  if (flag) return <Navigate to="/dashboard" replace />;
  return <Onboarding />;
};


// ─────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>

          {/* ── Root ── */}
          <Route path="/" element={<LandingOrDashboard />} />

          {/* ── Public ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />  {/* ✅ NEW — no auth needed */}

          {/* ── Onboarding (auth required, onboarding guard NOT applied) ── */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingRoute />
              </ProtectedRoute>
            }
          />

          {/* ── Protected + Onboarding-gated routes ── */}
          <Route path="/dashboard" element={
            <ProtectedRoute><OnboardingGuard><Layout><Dashboard /></Layout></OnboardingGuard></ProtectedRoute>
          } />

          <Route path="/conversations" element={
            <ProtectedRoute><OnboardingGuard><Layout><Conversations /></Layout></OnboardingGuard></ProtectedRoute>
          } />

          <Route path="/contacts" element={
            <ProtectedRoute><OnboardingGuard><Layout><Contacts /></Layout></OnboardingGuard></ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute><OnboardingGuard><Layout><Settings /></Layout></OnboardingGuard></ProtectedRoute>
          } />

          <Route path="/subscription" element={
            <ProtectedRoute><OnboardingGuard><Layout><Subscription /></Layout></OnboardingGuard></ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute><OnboardingGuard><Layout><Profile /></Layout></OnboardingGuard></ProtectedRoute>
          } />

          <Route path="/activity" element={
            <ProtectedRoute><OnboardingGuard><Layout><Activity /></Layout></OnboardingGuard></ProtectedRoute>
          } />

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;