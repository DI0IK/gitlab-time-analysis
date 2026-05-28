"use client";
import React from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useThemeMode } from "./ThemeContext";

export default function ThemeWrapper({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { resolvedMode, colorTheme } = useThemeMode();

  const theme = React.useMemo(() => {
    const isDark = resolvedMode === "dark";
    
    // Exact colors matching the CSS variables in globals.css
    let primaryMain = isDark ? "#8b5cf6" : "#7c3aed";
    let primaryLight = "#a78bfa";
    let primaryDark = isDark ? "#6d28d9" : "#5b21b6";
    
    let secondaryMain = "#10b981";
    let secondaryLight = "#34d399";
    let secondaryDark = "#047857";

    if (colorTheme === "dhbw") {
      primaryMain = isDark ? "#ef4444" : "#e2001a";
      primaryLight = isDark ? "#fca5a5" : "#fda4af";
      primaryDark = isDark ? "#b91c1c" : "#b50012";

      secondaryMain = isDark ? "#fb7185" : "#f43f5e";
      secondaryLight = isDark ? "#fca5a5" : "#fb7185";
      secondaryDark = isDark ? "#e11d48" : "#be123c";
    } else if (colorTheme === "green") {
      primaryMain = isDark ? "#10b981" : "#059669";
      primaryLight = isDark ? "#34d399" : "#6ee7b7";
      primaryDark = isDark ? "#065f46" : "#047857";

      secondaryMain = isDark ? "#34d399" : "#10b981";
      secondaryLight = isDark ? "#6ee7b7" : "#34d399";
      secondaryDark = isDark ? "#047857" : "#047857";
    } else if (colorTheme === "purple") {
      primaryMain = isDark ? "#a855f7" : "#7e22ce";
      primaryLight = isDark ? "#c084fc" : "#d8b4fe";
      primaryDark = isDark ? "#7e22ce" : "#6b21a8";

      secondaryMain = isDark ? "#c084fc" : "#a855f7";
      secondaryLight = isDark ? "#d8b4fe" : "#c084fc";
      secondaryDark = isDark ? "#9333ea" : "#7e22ce";
    }
    
    const bgDefault = isDark ? "#090d16" : "#f8fafc";
    const bgPaper = isDark ? "#111827" : "#ffffff";
    
    const textPrimary = isDark ? "#f3f4f6" : "#0f172a";
    const textSecondary = isDark ? "#9ca3af" : "#475569";
    
    const borderColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
    const cardShadow = isDark 
      ? "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)"
      : "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)";

    return createTheme({
      palette: {
        mode: resolvedMode,
        primary: {
          main: primaryMain,
          light: primaryLight,
          dark: primaryDark,
          contrastText: "#fff",
        },
        secondary: {
          main: secondaryMain,
          light: secondaryLight,
          dark: secondaryDark,
          contrastText: "#fff",
        },
        background: {
          default: bgDefault,
          paper: bgPaper,
        },
        text: {
          primary: textPrimary,
          secondary: textSecondary,
        },
        divider: borderColor,
      },
      typography: {
        fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        h4: {
          fontWeight: 800,
          letterSpacing: "-0.025em",
        },
        h5: {
          fontWeight: 700,
          letterSpacing: "-0.02em",
        },
        h6: {
          fontWeight: 650,
          letterSpacing: "-0.015em",
        },
        body1: {
          lineHeight: 1.6,
        },
      },
      shape: {
        borderRadius: 12,
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              scrollbarColor: isDark ? "#374151 #111827" : "#cbd5e1 #f1f5f9",
              "&::-webkit-scrollbar": {
                width: "8px",
                height: "8px",
              },
              "&::-webkit-scrollbar-track": {
                background: bgDefault,
              },
              "&::-webkit-scrollbar-thumb": {
                background: isDark ? "#374151" : "#cbd5e1",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                background: isDark ? "#4b5563" : "#94a3b8",
              },
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              backgroundImage: "none",
              backgroundColor: bgPaper,
              border: `1px solid ${borderColor}`,
              boxShadow: cardShadow,
              transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
              borderRadius: 16,
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 8,
              transition: "all 0.2s ease",
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: "none",
              transition: "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              backgroundColor: bgPaper,
              border: `1px solid ${borderColor}`,
              borderRadius: 16,
              boxShadow: isDark
                ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                : "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
            },
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: {
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              "& .MuiTableCell-root": {
                color: textSecondary,
                fontWeight: 700,
                textTransform: "uppercase",
                fontSize: "0.75rem",
                letterSpacing: "0.05em",
              },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              borderBottom: `1px solid ${borderColor}`,
              padding: "12px 16px",
              transition: "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
            },
          },
        },
      },
    });
  }, [resolvedMode, colorTheme]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
