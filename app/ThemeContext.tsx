"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ColorTheme = "default" | "dhbw" | "green" | "purple";

type ThemeContextType = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedMode: "light" | "dark";
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  presentationMode: boolean;
  setPresentationMode: (mode: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("default");
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("dark");
  const [presentationMode, setPresentationMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem("themeMode") as ThemeMode | null;
    if (savedMode) {
      setThemeModeState(savedMode);
    }
    const savedTheme = localStorage.getItem("colorTheme") as ColorTheme | null;
    if (savedTheme) {
      setColorThemeState(savedTheme);
    }
    setMounted(true);
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem("themeMode", mode);
  };

  const setColorTheme = (theme: ColorTheme) => {
    setColorThemeState(theme);
    localStorage.setItem("colorTheme", theme);
  };

  useEffect(() => {
    if (!mounted) return;

    if (presentationMode) {
      setResolvedMode("light");
      return;
    }

    if (themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        setResolvedMode(mediaQuery.matches ? "dark" : "light");
      };
      setResolvedMode(mediaQuery.matches ? "dark" : "light");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      setResolvedMode(themeMode);
    }
  }, [themeMode, presentationMode, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    if (resolvedMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.setAttribute("data-color-theme", colorTheme);
  }, [resolvedMode, colorTheme, mounted]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        resolvedMode,
        colorTheme,
        setColorTheme,
        presentationMode,
        setPresentationMode,
      }}
    >
      {!mounted ? (
        <div style={{ visibility: "hidden" }}>{children}</div>
      ) : (
        children
      )}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within a ThemeModeProvider");
  }
  return context;
}
