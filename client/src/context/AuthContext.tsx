import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile, loginApi, logoutApi, getMeApi } from "../api.js";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("cpms_token"));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getMeApi(token);
        setUser(data.user);
      } catch (err) {
        sessionStorage.removeItem("cpms_token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await loginApi(email, password);
    sessionStorage.setItem("cpms_token", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    if (token) {
      try {
        await logoutApi(token);
      } catch {
        // Ignore network errors on logout
      }
    }
    sessionStorage.removeItem("cpms_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
