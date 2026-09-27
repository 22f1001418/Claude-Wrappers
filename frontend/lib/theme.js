"use client";

import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "theme";
const DARK = "dark";
const LIGHT = "light";

function resolveInitialTheme() {
  if (typeof document !== "undefined") {
    const attrTheme = document.documentElement.getAttribute("data-theme");
    if (attrTheme === DARK || attrTheme === LIGHT) {
      return attrTheme;
    }
  }

  return getStoredTheme();
}

export function getStoredTheme() {
  if (typeof window === "undefined") {
    return DARK;
  }

  const value = localStorage.getItem(THEME_KEY);
  return value === LIGHT ? LIGHT : DARK;
}

export function applyTheme(theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", theme);
  document.body.style.background = theme === DARK ? "#0a0a0a" : "#faf8f5";
}

function persistTheme(theme) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(THEME_KEY, theme);
}

export function useSyncedTheme() {
  const [darkMode, setDarkMode] = useState(() => resolveInitialTheme() === DARK);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const theme = resolveInitialTheme();
    setDarkMode(theme === DARK);
    persistTheme(theme);
    applyTheme(theme);
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) {
      return;
    }

    const theme = darkMode ? DARK : LIGHT;
    persistTheme(theme);
    applyTheme(theme);
  }, [darkMode, themeReady]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== THEME_KEY) {
        return;
      }

      const nextTheme = event.newValue === LIGHT ? LIGHT : DARK;
      setDarkMode(nextTheme === DARK);
      applyTheme(nextTheme);
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    if (!themeReady) {
      return;
    }

    setDarkMode((previous) => !previous);
  }, [themeReady]);

  return { darkMode, setDarkMode, toggleTheme, themeReady };
}
