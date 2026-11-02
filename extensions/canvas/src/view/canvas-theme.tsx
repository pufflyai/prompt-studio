import { psTheme, type ThemePreferenceOption, ThemePreferenceProvider } from "@pstdio/ui";
import { createContext, type ReactNode, useContext } from "react";

export const CanvasThemeContext = createContext<ThemePreferenceOption>({ id: "pstdio-light", mode: "light" });
const previewThemeStorage = { getItem: () => null, setItem: () => {} };
export const CanvasThemeProvider = (props: { children: ReactNode }) => {
  const theme = useContext(CanvasThemeContext);
  return (
    <ThemePreferenceProvider initialPreference={theme.id} themePreferences={[theme]} storage={previewThemeStorage}>
      {props.children}
    </ThemePreferenceProvider>
  );
};
export const readCanvasTheme = (id: string): ThemePreferenceOption => {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const tokens: Record<string, string> = {};
  for (const token of psTheme.tokens.allTokens) {
    if (token.path[0] !== "colors") continue;
    const path = token.path.join(".");
    const value = css.getPropertyValue(`--chakra-${token.path.join("-")}`).trim();
    if (value) tokens[path] = value;
  }
  return { id, mode: root.classList.contains("dark") ? "dark" : "light", tokens };
};
