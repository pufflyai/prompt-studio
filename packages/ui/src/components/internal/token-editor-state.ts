import { useEffect, useState } from "react";
import {
  pstDarkTokenEditorValues,
  pstLightTokenEditorValues,
  type TokenEditorPresetId,
  type TokenEditorValues,
  tokenEditorTokens,
} from "@/components/internal/token-editor-data";
import {
  defaultThemePreferences,
  getThemePreferenceMode,
  type ThemePreference,
  type ThemePreferenceOption,
} from "@/utils/apply-theme-preference";

const tokenEditorStorageKey = "pstdio.ui.token-editor-overrides.v2";

interface UseTokenEditorValuesOptions {
  themePreference?: ThemePreference;
  themePreferences?: readonly ThemePreferenceOption[];
}

interface StoredTokenEditorOverrides {
  themePreference: ThemePreference;
  tokens: TokenEditorValues;
}

const getDefaultTokenEditorThemePreference = (): ThemePreference => {
  if (typeof document === "undefined") return "pstdio-light";

  return document.documentElement.getAttribute("data-theme") ?? "pstdio-light";
};

const getTokenEditorPresetIdForThemePreference = (
  themePreference: ThemePreference,
  themePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences,
): TokenEditorPresetId =>
  getThemePreferenceMode(themePreference, themePreferences) === "dark" ? "pst-dark" : "pst-light";

const getThemePreferenceTokenValues = (
  themePreference: ThemePreference,
  themePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences,
) => themePreferences.find((preference) => preference.id === themePreference)?.tokens ?? {};

export const getDefaultTokenEditorPresetId = (): TokenEditorPresetId => {
  if (typeof document === "undefined") return "pst-light";

  return document.documentElement.getAttribute("data-color-mode") === "dark" ? "pst-dark" : "pst-light";
};

export const getDefaultTokenEditorValues = (presetId = getDefaultTokenEditorPresetId()) =>
  presetId === "pst-dark" ? pstDarkTokenEditorValues : pstLightTokenEditorValues;

const getTokenEditorBaseValues = (
  themePreference: ThemePreference,
  themePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences,
) => {
  const presetId = getTokenEditorPresetIdForThemePreference(themePreference, themePreferences);

  return {
    ...getDefaultTokenEditorValues(presetId),
    ...getThemePreferenceTokenValues(themePreference, themePreferences),
  };
};

export const getTokenEditorOverrides = (values: TokenEditorValues, baseValues: TokenEditorValues) =>
  Object.fromEntries(
    tokenEditorTokens
      .map((token) => [token.id, values[token.id] ?? token.defaultValue, baseValues[token.id]] as const)
      .filter(([, value, defaultValue]) => value !== defaultValue)
      .map(([id, value]) => [id, value]),
  );

const clearStoredTokenEditorValues = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(tokenEditorStorageKey);
};

const readStoredTokenEditorValues = (baseValues: TokenEditorValues, themePreference: ThemePreference) => {
  if (typeof window === "undefined") return { ...baseValues };

  const storedOverrides = window.localStorage.getItem(tokenEditorStorageKey);
  if (!storedOverrides) return { ...baseValues };

  const stored = JSON.parse(storedOverrides) as StoredTokenEditorOverrides;
  if (stored.themePreference !== themePreference) {
    clearStoredTokenEditorValues();
    return { ...baseValues };
  }

  return { ...baseValues, ...stored.tokens };
};

const writeStoredTokenEditorValues = (
  values: TokenEditorValues,
  baseValues: TokenEditorValues,
  themePreference: ThemePreference,
) => {
  if (typeof window === "undefined") return;

  const overrides = getTokenEditorOverrides(values, baseValues);
  if (Object.keys(overrides).length === 0) {
    clearStoredTokenEditorValues();
    return;
  }

  window.localStorage.setItem(tokenEditorStorageKey, JSON.stringify({ themePreference, tokens: overrides }));
};

export const useTokenEditorValues = (options: UseTokenEditorValuesOptions = {}) => {
  const selectedThemePreference = options.themePreference ?? getDefaultTokenEditorThemePreference();
  const selectedThemePreferences = options.themePreferences ?? defaultThemePreferences;
  const [themePreference, setThemePreference] = useState<ThemePreference>(selectedThemePreference);
  const [basePresetId, setBasePresetId] = useState<TokenEditorPresetId>(() =>
    getTokenEditorPresetIdForThemePreference(selectedThemePreference, selectedThemePreferences),
  );
  const [baseValues, setBaseValues] = useState<TokenEditorValues>(() =>
    getTokenEditorBaseValues(selectedThemePreference, selectedThemePreferences),
  );
  const [values, setStoredValues] = useState<TokenEditorValues>(() =>
    readStoredTokenEditorValues(
      getTokenEditorBaseValues(selectedThemePreference, selectedThemePreferences),
      selectedThemePreference,
    ),
  );

  useEffect(() => {
    if (themePreference === selectedThemePreference) return;

    const nextBasePresetId = getTokenEditorPresetIdForThemePreference(
      selectedThemePreference,
      selectedThemePreferences,
    );
    const nextBaseValues = getTokenEditorBaseValues(selectedThemePreference, selectedThemePreferences);

    clearStoredTokenEditorValues();
    setThemePreference(selectedThemePreference);
    setBasePresetId(nextBasePresetId);
    setBaseValues(nextBaseValues);
    setStoredValues({ ...nextBaseValues });
  }, [themePreference, selectedThemePreference, selectedThemePreferences]);

  const setValues = (nextValues: TokenEditorValues) => {
    setStoredValues(nextValues);
    writeStoredTokenEditorValues(nextValues, baseValues, themePreference);
  };

  return { values, setValues, basePresetId, baseValues, themePreference };
};

export const exportTokenEditorOverrides = (
  values: TokenEditorValues,
  basePresetId: TokenEditorPresetId = getDefaultTokenEditorPresetId(),
  baseValues: TokenEditorValues = getDefaultTokenEditorValues(basePresetId),
) => {
  const payload = {
    basePreset: basePresetId,
    schemaVersion: 1,
    tokens: getTokenEditorOverrides(values, baseValues),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "pstdio-token-overrides.json";
  link.click();

  URL.revokeObjectURL(url);
};
