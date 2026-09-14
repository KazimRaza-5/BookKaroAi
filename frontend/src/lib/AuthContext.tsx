"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getToken, saveToken, clearToken } from "./auth";

type AuthContextType = {
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoggedIn(!!getToken());
    setIsLoading(false);
  }, []);

  function login(token: string) {
    saveToken(token);
    setIsLoggedIn(true);
  }

  function logout() {
    clearToken();
    setIsLoggedIn(false);
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
