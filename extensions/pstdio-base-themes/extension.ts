import { defineExtension, defineFileIconTheme, defineTheme, l10n, packageAsset } from "@pstdio/sdk/extensions";

const extension = defineExtension({
  themes: [
    defineTheme({
      id: "monokai",
      title: l10n("themes.monokai.title", "Monokai"),
      description: l10n("themes.monokai.description", "Monokai color theme mapped into Prompt Studio app and editor."),
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/monokai-color-theme.json", import.meta.url),
    }),
    defineTheme({
      id: "solarizedLight",
      title: l10n("themes.solarizedLight.title", "Solarized Light"),
      description: l10n("themes.solarizedLight.description", "Solarized Light color theme for Prompt Studio."),
      format: "vscode-color-theme",
      mode: "light",
      source: packageAsset("./themes/solarized-light-color-theme.json", import.meta.url),
    }),
    defineTheme({
      id: "solarizedDark",
      title: l10n("themes.solarizedDark.title", "Solarized Dark"),
      description: l10n("themes.solarizedDark.description", "Solarized Dark color theme for Prompt Studio."),
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/solarized-dark-color-theme.json", import.meta.url),
    }),
    defineTheme({
      id: "dracula",
      title: l10n("themes.dracula.title", "Dracula"),
      description: l10n("themes.dracula.description", "Dracula color theme mapped into Prompt Studio app and editor."),
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/dracula-color-theme.json", import.meta.url),
    }),
  ],

  fileIconThemes: [
    defineFileIconTheme({
      id: "seti",
      title: l10n("fileIconThemes.seti.title", "Seti"),
      description: l10n("fileIconThemes.seti.description", "Seti-style file icon theme with packaged font asset."),
      format: "vscode-file-icon-theme",
      source: packageAsset("./icons/seti-icon-theme.json", import.meta.url),
    }),
  ],
});

export default extension;
