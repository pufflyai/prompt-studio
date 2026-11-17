import { useThemePreference } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useEffect, useRef } from "react";
import i18n from "@/i18n";

export const DashboardHostPreferences = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const theme = useThemePreference();
  const themeRef = useRef(theme);
  const themeChanged = useRef<(() => void) | undefined>(undefined);
  const previousTheme = useRef(theme.themePreference);
  themeRef.current = theme;
  useEffect(() => {
    const themeAdapter = workbench.preferences.registerValueAdapter("dashboard.themePreference", {
      get: () => themeRef.current.themePreference,
      set: (value) => themeRef.current.setThemePreference(String(value)),
      onDidChange(listener) {
        themeChanged.current = listener;
        return () => {
          if (themeChanged.current === listener) themeChanged.current = undefined;
        };
      },
    });
    const localeAdapter = workbench.preferences.registerValueAdapter("dashboard.locale", {
      get: () => i18n.resolvedLanguage ?? i18n.language,
      set: async (value) => {
        await i18n.changeLanguage(String(value));
      },
      onDidChange(listener) {
        i18n.on("languageChanged", listener);
        return () => {
          i18n.off("languageChanged", listener);
        };
      },
    });
    return () => {
      themeAdapter.dispose();
      localeAdapter.dispose();
    };
  }, [workbench]);
  useEffect(() => {
    if (previousTheme.current === theme.themePreference) return;
    previousTheme.current = theme.themePreference;
    themeChanged.current?.();
  }, [theme.themePreference]);
  return null;
};
