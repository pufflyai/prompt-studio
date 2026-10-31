import type { ListExtensionAppearanceResponse } from "@pstdio/sdk/api";
import type { FileIconThemePreferenceOption, ThemePreferenceOption } from "@pstdio/ui";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getRuntimeCollections } from "@/lib/sync/collections";
import {
  localizeExtensionAppearance,
  type ResolvedWorkbenchExtensionAppearance,
} from "@/shared/extensions/extension-localization";

const toThemePreference = (theme: ResolvedWorkbenchExtensionAppearance["themes"][number]) =>
  ({
    id: theme.id,
    title: theme.title,
    mode: theme.mode,
    tokens: theme.tokens,
    monacoTheme: theme.monacoTheme,
  }) satisfies ThemePreferenceOption;

const toFileIconThemePreference = (theme: ResolvedWorkbenchExtensionAppearance["fileIconThemes"][number]) =>
  ({
    id: theme.id,
    title: theme.title,
    definitions: theme.definitions,
    fileExtensions: theme.fileExtensions,
    fileNames: theme.fileNames,
    defaults: theme.defaults,
    fonts: theme.fonts,
  }) satisfies FileIconThemePreferenceOption;

export const registerExtensionAppearance = (
  ctx: WorkbenchModuleContext,
  rawAppearance: ListExtensionAppearanceResponse,
  owner = getRuntimeCollections(),
) => {
  const appearance = localizeExtensionAppearance(rawAppearance, owner);
  const themeDisposable =
    appearance.themes.length > 0 ? ctx.themes.register(appearance.themes.map(toThemePreference)) : undefined;
  const fileIconThemeDisposable =
    appearance.fileIconThemes.length > 0
      ? ctx.fileIconThemes.register(appearance.fileIconThemes.map(toFileIconThemePreference))
      : undefined;
  return {
    dispose() {
      themeDisposable?.dispose();
      fileIconThemeDisposable?.dispose();
    },
  };
};
