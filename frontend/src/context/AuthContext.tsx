import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  subscriptionStatus: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updated: Partial<User>) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  onboardingComplete: boolean;                    // ✅ NEW
  setOnboardingComplete: (val: boolean) => void;  // ✅ NEW
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false); // ✅ NEW

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedOnboarding = localStorage.getItem('onboardingComplete'); // ✅ NEW

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }

    // ✅ NEW — restore onboarding flag
    if (storedOnboarding === 'true') {
      setOnboardingCompleteState(true);
    }

    setIsLoading(false);
  }, []);

  const login = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    // ✅ NEW — reset onboarding flag on fresh login
    const storedOnboarding = localStorage.getItem('onboardingComplete');
    setOnboardingCompleteState(storedOnboarding === 'true');
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setOnboardingCompleteState(false);          // ✅ NEW
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.setItem('onboardingComplete', 'false');
    
  };

  // Merge partial updates into user state + localStorage — UNCHANGED
  const updateUser = (updated: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updated };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  };

  // ✅ NEW — persists flag to localStorage
  const setOnboardingComplete = (val: boolean) => {
    setOnboardingCompleteState(val);
    localStorage.setItem('onboardingComplete', String(val));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateUser,
        isAuthenticated: !!token,
        isLoading,
        onboardingComplete,           // ✅ NEW
        setOnboardingComplete,        // ✅ NEW
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};