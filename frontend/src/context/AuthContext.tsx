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
  updateUser: (updated: Partial<User>) => void; // NEW
  isAuthenticated: boolean;
  isLoading: boolean;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }

    setIsLoading(false);
  }, []);


  const login = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };


  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };


  // NEW: merge partial updates into user state + localStorage
  const updateUser = (updated: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...updated };
      localStorage.setItem('user', JSON.stringify(merged));
      return merged;
    });
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        updateUser, // NEW
        isAuthenticated: !!token,
        isLoading,
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