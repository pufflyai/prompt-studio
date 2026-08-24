import { commandRef, defineExtension, l10n, packageAsset } from "@pstdio/sdk/extensions";
import { labCommands, labSchedules } from "./src/commands";
import { labSettings } from "./src/data/lab-settings";
import { labHarnesses } from "./src/harnesses";
import { labHooks } from "./src/hooks";
import { labMiddlewares } from "./src/middlewares";
import {
  createLabPanels,
  createLabRoutes,
  createLabSettingsPanels,
  createLabStatusItems,
  labActivityItems,
  labControlsRenderers,
  labDataTableRenderers,
  labModes,
  labResourceKinds,
  labTreeItems,
  labTreeRenderers,
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
  harnesses: labHarnesses,

  modes: labModes,
  resourceKinds: labResourceKinds,
  panels: createLabPanels(import.meta.url),
  statusItems: createLabStatusItems(import.meta.url),
  routes: createLabRoutes(import.meta.url),
  treeItems: labTreeItems,
  activityItems: labActivityItems,
  controlsRenderers: labControlsRenderers,
  dataTableRenderers: labDataTableRenderers,
  treeRenderers: labTreeRenderers,
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
      source: packageAsset("./skills/lab-resource", import.meta.url),
    },
  },
});

export default extension;
