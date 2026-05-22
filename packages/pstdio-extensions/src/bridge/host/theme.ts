import type { ThemePreference } from "../contract";

export const collectChakraThemeVariables = () => {
  if (typeof document === "undefined") return {};

  const computed = getComputedStyle(document.documentElement);
  const variables: Record<string, string> = {};
  for (let index = 0; index < computed.length; index += 1) {
    const name = computed.item(index);
    if (name.startsWith("--chakra-")) {
      variables[name] = computed.getPropertyValue(name).trim();
    }
  }
  return variables;
};

export const resolveActiveTheme = (fallback: ThemePreference): ThemePreference => {
  if (typeof document === "undefined") return fallback;
  const value = document.documentElement.getAttribute("data-theme");
  if (value === "dark" || value === "light") return value;

  const colorMode = document.documentElement.getAttribute("data-color-mode");
  return colorMode === "dark" || colorMode === "light" ? colorMode : fallback;
};

export const postThemeToFrame = (
  iframe: HTMLIFrameElement | null,
  theme: ThemePreference,
  variables: Record<string, string>,
) => {
  iframe?.contentWindow?.postMessage({ type: "pstdio.theme", theme, variables }, "*");
};
