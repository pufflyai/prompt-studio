import { isThemePreference, useThemePreference } from "@pstdio/ui";
import { useEffect } from "react";
import {
  buildOpenCommandPaletteMessage,
  readHostThemeMessage,
  shouldForwardCommandPaletteShortcut,
} from "../host-bridge";

export const LabHostBridge = () => {
  const { setThemePreference, themePreferences } = useThemePreference();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const themePreference = readHostThemeMessage(event.data);
      if (!themePreference || !isThemePreference(themePreference, themePreferences)) return;

      setThemePreference(themePreference);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setThemePreference, themePreferences]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldForwardCommandPaletteShortcut(event)) return;

      event.preventDefault();
      window.parent.postMessage(buildOpenCommandPaletteMessage(), window.location.origin);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
};
