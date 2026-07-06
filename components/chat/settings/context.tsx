"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type FC,
  type ReactNode,
} from "react";
import { loadSettings, saveSettings, subscribeSettings } from "./storage";
import { type Settings, DEFAULT_SETTINGS } from "./types";

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (updater: (prev: Settings) => Settings) => void;
  reloadSettings: () => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const reloadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await loadSettings();
      setSettings(loaded);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  useEffect(() => subscribeSettings(setSettings), []);

  const updateSettings = (updater: (prev: Settings) => Settings) => {
    setSettings((prev) => {
      const next = updater(prev);
      saveSettings(next);
      return next;
    });
  };

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, reloadSettings, isLoading }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return value;
}
