import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { StrictMode, useEffect, useState } from "react";
import type { DesktopStartupAppearance } from "../desktop-api";
import { initialDesktopState } from "../lifecycle/lifecycle-machine";
import { DesktopLifecycleApp } from "./desktop-lifecycle-app";

interface DesktopLifecycleRootProps {
  platform: string;
  initialAppearance: DesktopStartupAppearance | null;
}

const useStartupAppearance = (initialAppearance: DesktopStartupAppearance | null) => {
  const [appearance, setAppearance] = useState(initialAppearance);
  useEffect(() => {
    let active = true;
    const unsubscribe = window.promptStudioDesktop.onStartupAppearance(setAppearance);
    // The workbench can report a theme while this page hydrates, before it subscribes.
    void window.promptStudioDesktop.getStartupAppearance().then((next) => {
      if (active && next) setAppearance(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return appearance;
};

export const DesktopLifecycleRoot = (props: DesktopLifecycleRootProps) => {
  const { platform, initialAppearance } = props;
  const appearance = useStartupAppearance(initialAppearance);
  // This page never chooses a theme. It shows the theme the workbench last reported,
  // and follows the system light or dark setting until there is one.
  const storage = { getItem: () => appearance?.themeId ?? null, setItem: () => {} };
  const themePreferences = appearance
    ? [{ id: appearance.themeId, mode: appearance.mode, tokens: appearance.tokens }]
    : undefined;
  return (
    <StrictMode>
      <ThemePreferenceProvider storage={storage} themePreferences={themePreferences}>
        <ChakraProvider value={psTheme}>
          <DesktopLifecycleApp initialState={initialDesktopState} platform={platform} />
        </ChakraProvider>
      </ThemePreferenceProvider>
    </StrictMode>
  );
};
