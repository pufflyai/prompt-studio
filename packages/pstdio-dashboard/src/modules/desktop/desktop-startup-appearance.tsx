import { useThemePreference } from "@pstdio/ui";
import { useEffect } from "react";
import type { DesktopLifecycleBridge } from "@/lib/desktop-lifecycle-bridge";

/**
 * Reports the theme the workbench shows, so the desktop startup, recovery, and closing
 * screens can use it before the runtime and its extensions start.
 */
export const DesktopStartupAppearance = (props: { bridge: DesktopLifecycleBridge }) => {
  const { bridge } = props;
  const { pendingThemePreference, themePreference, themePreferences } = useThemePreference();
  const theme = themePreferences.find((option) => option.id === themePreference);

  useEffect(() => {
    // A fallback shown while the chosen extension theme loads must not replace the saved one.
    if (!theme || pendingThemePreference) return;
    // The theme provider applies the theme to the document in its own effect, after this one.
    const timer = setTimeout(() => {
      void bridge
        .setStartupAppearance({
          themeId: theme.id,
          mode: theme.mode,
          tokens: theme.tokens ?? {},
          backgroundColor: getComputedStyle(document.body).backgroundColor,
        })
        .catch((error: unknown) => {
          // The lifecycle screens keep the last saved theme; the workbench is unaffected.
          console.warn("Could not save the desktop startup theme", error);
        });
    });
    return () => clearTimeout(timer);
  }, [bridge, theme, pendingThemePreference]);

  return null;
};
