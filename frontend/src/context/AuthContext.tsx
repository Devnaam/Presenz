import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User } from '../types';


// ─────────────────────────────────────────────────────────────────
// Plan limits — mirrors backend PLAN_CONFIG + TRIAL_LIMITS
// Single source of truth on the frontend
// ─────────────────────────────────────────────────────────────────
const PLAN_LIMITS: Record<string, { contacts: number; repliesPerDay: number }> = {
  trial:    { contacts: 1,      repliesPerDay: 100      },
  pro:      { contacts: 5,      repliesPerDay: 500      },
  business: { contacts: 25,     repliesPerDay: 999999   }, // Infinity represented as large number
};


// ─────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────
interface AuthContextType {
  user:                 User | null;
  token:                string | null;
  isAuthenticated:      boolean;
  isLoading:            boolean;

  // Auth actions
  login:                (user: User, token: string) => void;
  logout:               () => void;
  updateUser:           (updated: Partial<User>) => void;

  // Onboarding
  onboardingComplete:    boolean;
  setOnboardingComplete: (val: boolean) => void;

  // ── Computed subscription helpers ────────────────────────────
  // These are derived from user fields — no extra API call needed
  isPending:             boolean;   // registered but trial not activated yet
  isTrialActive:         boolean;   // trial activated and not expired
  isPaid:                boolean;   // active paid plan (pro or business)
  isExpired:             boolean;   // trial or paid plan has lapsed
  isGrace:               boolean;   // payment failed, within 3-day grace window
  trialDaysLeft:         number;    // 0 if not on trial
  planLimits:            { contacts: number; repliesPerDay: number };
  canAddContact:         (currentCount: number) => boolean;
  canSendReply:          () => boolean;   // checks repliesUsedToday vs limit
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);


// ─────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,     setUser]     = useState<User | null>(null);
  const [token,    setToken]    = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);


  // ── Restore session from localStorage on mount ────────────────
  useEffect(() => {
    const storedToken      = localStorage.getItem('token');
    const storedUser       = localStorage.getItem('user');
    const storedOnboarding = localStorage.getItem('onboardingComplete');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        // Corrupted data — clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    if (storedOnboarding === 'true') {
      setOnboardingCompleteState(true);
    }

    setIsLoading(false);
  }, []);


  // ── login ────────────────────────────────────────────────────
  const login = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));

    // Restore onboarding flag for this user if it was previously set
    const storedOnboarding = localStorage.getItem('onboardingComplete');
    setOnboardingCompleteState(storedOnboarding === 'true');
  };


  // ── logout ───────────────────────────────────────────────────
  const logout = () => {
    setUser(null);
    setToken(null);
    setOnboardingCompleteState(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.setItem('onboardingComplete', 'false');
  };


  // ── updateUser ───────────────────────────────────────────────
  // Merges partial updates into user state + localStorage
  // Used after activateTrial, payment success, profile save, etc.
  const updateUser = (updated: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updated };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  };


  // ── setOnboardingComplete ────────────────────────────────────
  const setOnboardingComplete = (val: boolean) => {
    setOnboardingCompleteState(val);
    localStorage.setItem('onboardingComplete', String(val));
  };


  // ── Computed subscription values (memoised) ──────────────────
  const subscriptionHelpers = useMemo(() => {
    const status = user?.subscriptionStatus ?? 'pending';
    const plan   = user?.plan ?? 'trial';

    const isPending     = status === 'pending';
    const isTrialActive = status === 'trial';
    const isPaid        = status === 'active';
    const isExpired     = status === 'expired';
    const isGrace       = status === 'grace';

    // Days left in trial
    let trialDaysLeft = 0;
    if (isTrialActive && user?.trialEndsAt) {
      const msLeft  = new Date(user.trialEndsAt).getTime() - Date.now();
      trialDaysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    }

    // Plan limits
    const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS['trial'];

    // Contact limit check — pass in how many contacts user currently has
    const canAddContact = (currentCount: number): boolean => {
      if (isPending || isExpired) return false;
      if (plan === 'business') return true;
      return currentCount < planLimits.contacts;
    };

    // Reply limit check — uses repliesUsedToday from user object
    const canSendReply = (): boolean => {
      if (isPending || isExpired) return false;
      if (isGrace) return false;  // grace period — no new replies
      if (plan === 'business') return true;
      return (user?.repliesUsedToday ?? 0) < planLimits.repliesPerDay;
    };

    return {
      isPending,
      isTrialActive,
      isPaid,
      isExpired,
      isGrace,
      trialDaysLeft,
      planLimits,
      canAddContact,
      canSendReply,
    };
  }, [user]);


  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated:      !!token,
        isLoading,
        login,
        logout,
        updateUser,
        onboardingComplete,
        setOnboardingComplete,
        ...subscriptionHelpers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


// ─────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};