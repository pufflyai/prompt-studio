import { useThemePreference } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { useEffect, useRef } from "react";
import i18n from "@/i18n";

export const DashboardHostPreferences = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const theme = useThemePreference();
  const themeRef = useRef(theme);
  themeRef.current = theme;
  useEffect(() => {
    const themeAdapter = workbench.preferences.registerValueAdapter("dashboard.themePreference", {
      get: () => themeRef.current.themePreference,
      set: (value) => themeRef.current.setThemePreference(String(value)),
    });
    const localeAdapter = workbench.preferences.registerValueAdapter("dashboard.locale", {
      get: () => i18n.resolvedLanguage ?? i18n.language,
      set: async (value) => {
        await i18n.changeLanguage(String(value));
      },
    });
    return () => {
      themeAdapter.dispose();
      localeAdapter.dispose();
    };
  }, [workbench]);
  return null;
};
