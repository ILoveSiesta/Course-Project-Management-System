import React, { createContext, useContext, useState, useEffect } from "react";
import { ApiError, UserProfile, loginApi, logoutApi, getMeApi } from "../api.js";

// #94 group B (F-01 v0.12 §3, SDS §3.2): session lifecycle texts.
export const SESSION_ENDED_MESSAGE = "Your session has ended. Please log in again.";
export const SESSION_CHECK_FAILED_MESSAGE = "Could not check your session. Check your connection and try again.";
export const LOGOUT_FAILED_MESSAGE = "Could not log out. Check your connection and try again.";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  // Shown on the login page after a 401 ended the session.
  notice: string | null;
  // Set when /api/auth/me failed for a reason other than 401; the token is kept.
  sessionError: string | null;
  // Set when the logout request failed; the user stays signed in.
  logoutError: string | null;
  login: (email: string, password: string) => Promise<void>;
  // Without options: the session ended because an API call answered 401 (every caller in the app does this).
  // With { manual: true }: the user pressed Log out, so the token is revoked on the server first.
  logout: (options?: { manual?: boolean }) => Promise<void>;
  retrySession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("cpms_token"));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [checkAttempt, setCheckAttempt] = useState(0);

  const clearSession = (message: string | null) => {
    sessionStorage.removeItem("cpms_token");
    setToken(null);
    setUser(null);
    setSessionError(null);
    setLogoutError(null);
    setNotice(message);
  };

  useEffect(() => {
    let active = true;

    async function loadUser() {
      // No token, or the user already came with the login response: nothing to check (#94 B4).
      if (!token || user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setSessionError(null);
      try {
        const data = await getMeApi(token);
        if (active) setUser(data.user);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) clearSession(SESSION_ENDED_MESSAGE);
        else setSessionError(SESSION_CHECK_FAILED_MESSAGE);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadUser();
    // A response for an older token, or after logout, is ignored (#94 B4).
    return () => {
      active = false;
    };
  }, [token, checkAttempt]); // `user` is read only to skip the check right after login

  const login = async (email: string, password: string) => {
    const data = await loginApi(email, password);
    sessionStorage.setItem("cpms_token", data.token);
    setNotice(null);
    setSessionError(null);
    setUser(data.user);
    setToken(data.token);
  };

  const logout = async (options?: { manual?: boolean }) => {
    if (!options?.manual) {
      // The server already rejected the token (401), so there is nothing to revoke (#94 B1).
      clearSession(SESSION_ENDED_MESSAGE);
      return;
    }
    setLogoutError(null);
    if (token) {
      try {
        await logoutApi(token);
      } catch (err) {
        // 401: the token is already invalid on the server, which counts as signed out (#94 B3).
        if (!(err instanceof ApiError && err.status === 401)) {
          setLogoutError(LOGOUT_FAILED_MESSAGE);
          return;
        }
      }
    }
    clearSession(null);
  };

  const retrySession = () => setCheckAttempt((n) => n + 1);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, notice, sessionError, logoutError, login, logout, retrySession }}
    >
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
