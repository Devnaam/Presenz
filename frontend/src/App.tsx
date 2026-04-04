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

// Root — Landing for guests, Dashboard for logged-in users
const LandingOrDashboard: React.FC = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
};

// ✅ FIXED — reads localStorage directly (sync) instead of React state (async)
// React state updates are batched and async — by the time OnboardingGuard renders
// after navigate(), the state hasn't updated yet → always bounces back to /onboarding
// localStorage.setItem() in Login.tsx runs synchronously BEFORE navigate() fires,
// so this read is always accurate
const OnboardingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const flag = localStorage.getItem('onboardingComplete') === 'true';
  if (!flag) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

// Guards /onboarding — if already done, skip straight to dashboard
const OnboardingRoute: React.FC = () => {
  const flag = localStorage.getItem('onboardingComplete') === 'true';
  if (flag) return <Navigate to="/dashboard" replace />;
  return <Onboarding />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>

          <Route path="/" element={<LandingOrDashboard />} />

          {/* Public */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Onboarding */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingRoute />
              </ProtectedRoute>
            }
          />

          {/* Protected + Onboarding-gated */}
          <Route path="/dashboard" element={
            <ProtectedRoute><OnboardingGuard><Layout><Dashboard /></Layout></OnboardingGuard></ProtectedRoute>
          }/>
          <Route path="/conversations" element={
            <ProtectedRoute><OnboardingGuard><Layout><Conversations /></Layout></OnboardingGuard></ProtectedRoute>
          }/>
          <Route path="/contacts" element={
            <ProtectedRoute><OnboardingGuard><Layout><Contacts /></Layout></OnboardingGuard></ProtectedRoute>
          }/>
          <Route path="/settings" element={
            <ProtectedRoute><OnboardingGuard><Layout><Settings /></Layout></OnboardingGuard></ProtectedRoute>
          }/>
          <Route path="/subscription" element={
            <ProtectedRoute><OnboardingGuard><Layout><Subscription /></Layout></OnboardingGuard></ProtectedRoute>
          }/>
          <Route path="/profile" element={
            <ProtectedRoute><OnboardingGuard><Layout><Profile /></Layout></OnboardingGuard></ProtectedRoute>
          }/>
          <Route path="/activity" element={
            <ProtectedRoute><OnboardingGuard><Layout><Activity /></Layout></OnboardingGuard></ProtectedRoute>
          }/>

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;