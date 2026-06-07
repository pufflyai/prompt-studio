import { commandRef, defineExtension, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { labCommands, labSchedules } from "./src/commands";
import { labSettings } from "./src/data/lab-settings";
import { labHooks } from "./src/hooks";
import { labMiddlewares } from "./src/middlewares";
import {
  createLabRoutes,
  createLabSettingsPanels,
  createLabViews,
  labDataRenderers,
  labModes,
  labTreeItems,
} from "./src/renderers/ui-contributions";

const extension = defineExtension({
  defaultLocale: "en",
  translations: {
    fr: packageAsset("./l10n/fr.json", import.meta.url),
  },

  settings: labSettings,

  commands: labCommands,
  middlewares: labMiddlewares,
  hooks: labHooks,
  schedules: labSchedules,

  modes: labModes,
  views: createLabViews(import.meta.url),
  routes: createLabRoutes(import.meta.url),
  treeItems: labTreeItems,
  dataRenderers: labDataRenderers,
  commandPaletteResources: {
    slides: {
      title: l10n("commandPaletteResources.slides.title", "Lab slides"),
      resourceKind: "lab.slide",
      queryCommand: commandRef("extension-lab.command-palette-resources.query"),
    },
  },
  settingsPanels: createLabSettingsPanels(import.meta.url),

  keybindings: {
    "say-hello": {
      key: "mod+shift+h",
      command: commandRef("extension-lab.say-hello"),
    },
  },

  templates: {
    labResource: {
      title: l10n("templates.labResource.title", "Glass Lab artifact"),
      type: "glass-lab-artifact",
      source: packageAsset("./templates/lab-ticket.md", import.meta.url),
    },
  },

  skills: {
    labResource: {
      title: l10n("skills.labResource.title", "Glass Lab Curator"),
      source: packageAsset("./skills/lab-skill", import.meta.url),
    },
  },

  themes: {
    glassLab: {
      title: l10n("themes.glassLab.title", "Glass Lab"),
      description: l10n(
        "themes.glassLab.description",
        "Cold glass, soft daylight, and controlled amber accents for a sealed research lab.",
      ),
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/glass-lab-color-theme.json", import.meta.url),
    },
    monokai: {
      title: l10n("themes.monokai.title", "Monokai"),
      description: l10n(
        "themes.monokai.description",
        "Monokai color theme mapped into Prompt Studio app and editor themes.",
      ),
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/monokai-color-theme.json", import.meta.url),
    },
    dracula: {
      title: l10n("themes.dracula.title", "Dracula"),
      description: l10n(
        "themes.dracula.description",
        "Dracula color theme mapped into Prompt Studio app and editor themes.",
      ),
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/dracula-color-theme.json", import.meta.url),
    },
  },

  fileIconThemes: {
    glassLab: {
      title: l10n("fileIconThemes.glassLab.title", "Glass Lab files"),
      description: l10n("fileIconThemes.glassLab.description", "Glass-blue file icons for the Glass Lab demo."),
      format: "vscode-file-icon-theme",
      source: packageAsset("./icons/glass-lab-icon-theme.json", import.meta.url),
    },
    seti: {
      title: l10n("fileIconThemes.seti.title", "Seti"),
      description: l10n("fileIconThemes.seti.description", "Seti-style file icon theme with packaged font asset."),
      format: "vscode-file-icon-theme",
      source: packageAsset("./icons/seti-icon-theme.json", import.meta.url),
    },
  },
});

export default extension;
