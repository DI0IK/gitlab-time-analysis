"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  InputAdornment,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Visibility, VisibilityOff, Lock, Palette } from "@mui/icons-material";
import { useUserAuth } from "../UserAuthContext";
import { useThemeMode } from "../ThemeContext";

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { token: currentToken, login, logout } = useUserAuth();
  const { colorTheme, setColorTheme } = useThemeMode();
  
  const [tokenInput, setTokenInput] = useState(currentToken || "");
  const [themeInput, setThemeInput] = useState(colorTheme);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync themeInput with colorTheme if it changes from outside or on reopen
  useEffect(() => {
    if (open) {
      setThemeInput(colorTheme);
      setTokenInput(currentToken || "");
      setError(null);
      setSuccess(false);
    }
  }, [open, colorTheme, currentToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const trimmedToken = tokenInput.trim();
      let tokenChanged = trimmedToken !== (currentToken || "");

      if (tokenChanged) {
        if (trimmedToken) {
          await login(trimmedToken);
        } else {
          logout();
        }
      }

      // Save theme preset
      setColorTheme(themeInput);
      setSuccess(true);
      
      // If the page will reload because of login/logout, don't trigger onClose manual redirect
      if (!tokenChanged) {
        setTimeout(() => {
          onClose();
        }, 800);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        Settings
      </DialogTitle>
      <form onSubmit={handleSave}>
        <DialogContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "primary.main" }}>
            GitLab Authentication
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Adding your GitLab Personal Access Token enables interactive features (such as modifying issue labels) and fetches group data using your personal GitLab permissions. The token is stored locally in your browser.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Successfully saved settings!
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              label="GitLab Private Access Token"
              variant="outlined"
              fullWidth
              disabled={loading}
              type={showToken ? "text" : "password"}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="glpat-..."
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle token visibility"
                        onClick={() => setShowToken(!showToken)}
                        edge="end"
                        size="small"
                        disabled={loading}
                      >
                        {showToken ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }
              }}
            />

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main" }}>
              Appearance Accent Theme
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Choose a color theme preset that adjusts core app accents and category colors.
            </Typography>

            <FormControl fullWidth disabled={loading}>
              <InputLabel id="theme-select-label">Color Theme Preset</InputLabel>
              <Select
                labelId="theme-select-label"
                id="theme-select"
                value={themeInput}
                label="Color Theme Preset"
                onChange={(e) => setThemeInput(e.target.value as any)}
                startAdornment={
                  <InputAdornment position="start">
                    <Palette fontSize="small" color="action" style={{ marginRight: 8 }} />
                  </InputAdornment>
                }
              >
                <MenuItem value="default">Default (Amethyst / Violet)</MenuItem>
                <MenuItem value="dhbw">DHBW Theme (Crimson Red)</MenuItem>
                <MenuItem value="green">Emerald Green</MenuItem>
                <MenuItem value="purple">Royal Purple</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} disabled={loading} color="inherit">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ minWidth: 100 }}
          >
            {loading ? <CircularProgress size={24} /> : "Save Settings"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
