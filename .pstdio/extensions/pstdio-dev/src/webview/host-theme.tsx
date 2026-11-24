import { ThemePreferenceProvider } from "@pstdio/ui";
import { type ReactNode, useSyncExternalStore } from "react";

const storage = { getItem: () => null, setItem: () => {} };
const themes = [
  { id: "host-light", mode: "light" },
  { id: "host-dark", mode: "dark" },
] as const;
const getMode = () => (document.documentElement.classList.contains("dark") ? "host-dark" : "host-light");
const subscribe = (listener: () => void) => {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};

// The bridge owns the injected color tokens. Supply its mode to shared components
// without storing a second theme choice or replacing the host's token values.
export const HostTheme = (props: { children: ReactNode }) => {
  const theme = useSyncExternalStore(subscribe, getMode);
  return (
    <ThemePreferenceProvider defaultPreference={theme} themePreferences={themes} storage={storage}>
      {props.children}
    </ThemePreferenceProvider>
  );
};
