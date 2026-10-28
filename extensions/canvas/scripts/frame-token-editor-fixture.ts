import type { ThemePreferenceOption } from "@pstdio/ui";
import { useState } from "react";

type Preset = "pst-light" | "pst-dark";
interface Options {
  themePreference: string;
  themePreferences: readonly ThemePreferenceOption[];
}
// The gallery's authoring controls stay local to this example rather than saving
// token overrides into browser storage, which an extension sandbox cannot use.
export const useCanvasTokenEditorValues = (options: Options, defaults: (preset: Preset) => Record<string, string>) => {
  const { themePreference, themePreferences } = options;
  const theme = themePreferences.find((theme) => theme.id === themePreference);
  const basePresetId: Preset = theme?.mode === "dark" ? "pst-dark" : "pst-light";
  const baseValues = { ...defaults(basePresetId), ...theme?.tokens };
  const [state, setState] = useState({ theme: themePreference, values: baseValues });
  if (state.theme !== themePreference) setState({ theme: themePreference, values: baseValues });
  return {
    basePresetId,
    baseValues,
    values: state.values,
    setValues: (values: Record<string, string>) => setState({ theme: themePreference, values }),
  };
};
