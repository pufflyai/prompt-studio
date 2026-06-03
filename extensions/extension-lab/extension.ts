import { defineExtension, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { labCommands, labSchedules } from "./src/commands";
import { labSettings } from "./src/data/lab-settings";
import { labHooks } from "./src/hooks";
import { labMiddlewares } from "./src/middlewares";
import {
  createLabRoutes,
  createLabSettingsPanels,
  createLabViews,
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
  settingsPanels: createLabSettingsPanels(import.meta.url),

  templates: {
    labTicket: {
      title: l10n("templates.labTicket.title", "Lab Ticket"),
      type: "ticket",
      source: packageAsset("./templates/lab-ticket.md", import.meta.url),
    },
  },

  skills: {
    lab: {
      title: l10n("skills.lab.title", "Lab Skill"),
      source: packageAsset("./skills/lab-skill", import.meta.url),
    },
  },

  themes: {
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
    seti: {
      title: l10n("fileIconThemes.seti.title", "Seti"),
      description: l10n("fileIconThemes.seti.description", "Seti-style file icon theme with packaged font asset."),
      format: "vscode-file-icon-theme",
      source: packageAsset("./icons/seti-icon-theme.json", import.meta.url),
    },
  },
});

export default extension;
