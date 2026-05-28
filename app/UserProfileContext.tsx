"use client";
import React, { createContext, useState, useContext } from "react";

type UserProfileContextType = {
  profileUsername: string | null;
  openProfile: (username: string) => void;
  closeProfile: () => void;
};

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  const openProfile = (username: string) => {
    setProfileUsername(username);
  };

  const closeProfile = () => {
    setProfileUsername(null);
  };

  return (
    <UserProfileContext.Provider value={{ profileUsername, openProfile, closeProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}
