import type { ListExtensionAppearanceResponse } from "@pstdio/sdk/api";
import type { FileIconThemePreferenceOption, ThemePreferenceOption } from "@pstdio/ui";
import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
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

export const resolveExtensionAppearancePreferences = (
  rawAppearance: ListExtensionAppearanceResponse,
  owner = getRuntimeCollections(),
) => {
  const appearance = localizeExtensionAppearance(rawAppearance, owner);
  return {
    themes: appearance.themes.map(toThemePreference),
    fileIconThemes: appearance.fileIconThemes.map(toFileIconThemePreference),
  };
};

export const registerExtensionAppearance = (
  ctx: Pick<WorkbenchModuleContext, "themes" | "fileIconThemes">,
  appearance: ReturnType<typeof resolveExtensionAppearancePreferences>,
) => {
  let themeDisposable: Disposable | undefined;
  let fileIconThemeDisposable: Disposable | undefined;
  let themeSignature: string | undefined;
  let fileIconSignature: string | undefined;
  const update = (next: typeof appearance) => {
    const themes = JSON.stringify(next.themes);
    if (themes !== themeSignature) {
      const previous = themeDisposable;
      themeDisposable = next.themes.length ? ctx.themes.register(next.themes) : undefined;
      previous?.dispose();
      themeSignature = themes;
    }
    const icons = JSON.stringify(next.fileIconThemes);
    if (icons !== fileIconSignature) {
      const previous = fileIconThemeDisposable;
      fileIconThemeDisposable = next.fileIconThemes.length
        ? ctx.fileIconThemes.register(next.fileIconThemes)
        : undefined;
      previous?.dispose();
      fileIconSignature = icons;
    }
  };
  update(appearance);
  return {
    update,
    dispose() {
      themeDisposable?.dispose();
      fileIconThemeDisposable?.dispose();
    },
  };
};
