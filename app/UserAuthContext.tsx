"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

export type GitLabUser = {
  id: number;
  name: string;
  username: string;
  avatarUrl: string | null;
  webUrl: string;
};

type UserAuthContextType = {
  token: string | null;
  user: GitLabUser | null;
  loading: boolean;
  login: (token: string) => Promise<GitLabUser>;
  logout: () => void;
};

const UserAuthContext = createContext<UserAuthContextType | undefined>(undefined);

export function UserAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<GitLabUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("gitlab_token");
    const storedUser = localStorage.getItem("gitlab_user");

    if (storedToken) {
      setToken(storedToken);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {}
      }
    }
    setLoading(false);
  }, []);

  const login = async (inputToken: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/users/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inputToken }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Authentication failed");
      }
      const userData = await response.json();
      
      localStorage.setItem("gitlab_token", inputToken);
      localStorage.setItem("gitlab_user", JSON.stringify(userData));

      setToken(inputToken);
      setUser(userData);
      
      // Reload pages to refresh fetchers with the new authorization headers
      window.location.reload();
      
      return userData;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("gitlab_token");
    localStorage.removeItem("gitlab_user");
    setToken(null);
    setUser(null);
    window.location.reload();
  };

  return (
    <UserAuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </UserAuthContext.Provider>
  );
}

export function useUserAuth() {
  const context = useContext(UserAuthContext);
  if (context === undefined) {
    throw new Error("useUserAuth must be used within a UserAuthProvider");
  }
  return context;
}
