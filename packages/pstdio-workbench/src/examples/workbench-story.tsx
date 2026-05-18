import { getThemePreferenceMode, useThemePreference } from "@pstdio/ui";
import { useEffect, useRef } from "react";
import type { WorkbenchCore } from "../core";
import { useWorkbenchStore, Workbench } from "../react";

export interface WorkbenchStoryProps {
  workbench: WorkbenchCore;
}

export const WorkbenchStory = (props: WorkbenchStoryProps) => {
  const { workbench } = props;
  const { themePreference, themePreferences, setThemePreference } = useThemePreference();
  const themeMode = getThemePreferenceMode(themePreference, themePreferences);
  const workbenchThemeId = useWorkbenchStore(workbench.theme.store, (state) => state.theme.id);
  const previousStoryThemeModeRef = useRef<string | undefined>(undefined);
  const previousWorkbenchThemeIdRef = useRef<string | undefined>(undefined);
  const workbenchThemeSubscriptionReadyRef = useRef(false);

  useEffect(() => {
    if (previousStoryThemeModeRef.current === themeMode) return;
    previousStoryThemeModeRef.current = themeMode;

    if (workbench.theme.getTheme().id === themeMode) return;
    workbench.theme.setTheme(themeMode);
  }, [themeMode, workbench]);

  useEffect(() => {
    if (!workbenchThemeSubscriptionReadyRef.current) {
      workbenchThemeSubscriptionReadyRef.current = true;
      previousWorkbenchThemeIdRef.current = workbenchThemeId;
      return;
    }

    if (previousWorkbenchThemeIdRef.current === workbenchThemeId) return;
    previousWorkbenchThemeIdRef.current = workbenchThemeId;

    if (workbenchThemeId !== "light" && workbenchThemeId !== "dark") return;

    const workbenchThemeMode = workbenchThemeId === "dark" ? "dark" : "light";
    if (workbenchThemeMode === themeMode) return;

    const nextPreference = themePreferences.find((preference) => preference.mode === workbenchThemeMode);
    if (nextPreference) setThemePreference(nextPreference.id);
  }, [setThemePreference, themeMode, themePreferences, workbenchThemeId]);

  return <Workbench workbench={workbench} />;
};
