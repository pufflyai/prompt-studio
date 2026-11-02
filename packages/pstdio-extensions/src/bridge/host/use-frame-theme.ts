import { type RefObject, useEffect } from "react";
import type { HostApi, ThemePreference } from "../contract";
import { collectChakraThemeVariables, resolveActiveTheme } from "./theme";

export const useFrameTheme = (input: {
  theme: ThemePreference;
  themeRoot: RefObject<(() => HTMLElement | null) | undefined>;
  initialized: RefObject<boolean>;
  remote: RefObject<Pick<HostApi, "themeUpdate"> | null>;
}) => {
  const { theme, themeRoot, initialized, remote } = input;
  useEffect(() => {
    if (!initialized.current) return;
    remote.current?.themeUpdate({
      theme: resolveActiveTheme(theme, themeRoot.current?.()),
      variables: collectChakraThemeVariables(themeRoot.current?.()),
    });
  }, [theme, themeRoot, initialized, remote]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!initialized.current) return;
        const root = themeRoot.current?.();
        remote.current?.themeUpdate({
          theme: resolveActiveTheme(theme, root),
          variables: collectChakraThemeVariables(root),
        });
      });
    };
    const observer = new MutationObserver(schedule);
    const options = { attributeFilter: ["class", "data-color-mode", "data-theme", "style"], attributes: true };
    const root = themeRoot.current?.();
    observer.observe(root ?? document.documentElement, options);
    if (!root) observer.observe(document.body, options);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [theme, themeRoot, initialized, remote]);
};
