import type { ListExtensionAppearanceResponse } from "@pstdio/sdk/api";
import type { ThemePreferenceOption } from "@pstdio/ui";
import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import {
  localizeExtensionAppearance,
  type ResolvedWorkbenchExtensionAppearance,
  registerExtensionTranslationBundles,
} from "@/shared/extensions/extension-localization";

export const emptyDashboardExtensionAppearance = {
  themes: [],
  fileIconThemes: [],
  translations: [],
  diagnostics: [],
} satisfies ListExtensionAppearanceResponse;

const toThemePreference = (theme: ResolvedWorkbenchExtensionAppearance["themes"][number]) =>
  ({
    id: theme.id,
    title: theme.title,
    mode: theme.mode,
    tokens: theme.tokens,
    monacoTheme: theme.monacoTheme,
  }) satisfies ThemePreferenceOption;

export const registerExtensionAppearance = (
  ctx: WorkbenchModuleContributionContext,
  rawAppearance: ListExtensionAppearanceResponse,
) => {
  const translationDisposable = registerExtensionTranslationBundles(rawAppearance);
  const appearance = localizeExtensionAppearance(rawAppearance);
  const themeDisposable =
    appearance.themes.length > 0 ? ctx.themes.register(appearance.themes.map(toThemePreference)) : undefined;
  return {
    dispose() {
      themeDisposable?.dispose();
      translationDisposable.dispose();
    },
  };
};
