import {
  defineCommandPaletteResource,
  defineExtension,
  defineKeybinding,
  defineSkill,
  defineTemplate,
  l10n,
  packageAsset,
} from "@pstdio/sdk/extensions";
import { labCommands, labSchedules } from "./src/commands";
import { queryLabResources } from "./src/commands/lab-resources-command";
import { sayHelloCommand } from "./src/commands/say-hello-command";
import { labSettings } from "./src/data/lab-settings";
import { labHarnesses } from "./src/harnesses";
import { labHooks } from "./src/hooks";
import { labMiddlewares } from "./src/middlewares";
import { labWorkflowStatuses } from "./src/renderers/lab-workflow-statuses";
import {
  createLabUi,
  labActivityItems,
  labModes,
  labResourceKinds,
  labSettingsSection,
} from "./src/renderers/ui-contributions";

const labUi = createLabUi(import.meta.url);

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
  views: labUi.views,
  resourceViews: labUi.resourceViews,
  viewMenus: labUi.viewMenus,
  placements: labUi.placements,
  navigationItems: labUi.navigationItems,
  statusBarItems: labUi.statusBarItems,
  statuses: [labWorkflowStatuses],
  activityItems: labActivityItems,
  commandPaletteResources: [
    defineCommandPaletteResource({
      id: "slides",
      title: l10n("commandPaletteResources.slides.title", "Lab slides"),
      query: queryLabResources,
    }),
  ],
  settingsPanels: labUi.settingsPanels,
  settingsSections: [labSettingsSection],

  keybindings: [
    defineKeybinding({
      id: "say-hello",
      key: "mod+shift+h",
      command: sayHelloCommand.ref,
    }),
  ],

  templates: [
    defineTemplate({
      id: "labResource",
      title: l10n("templates.labResource.title", "Glass Lab artifact"),
      type: "glass-lab-artifact",
      source: packageAsset("./templates/lab-ticket.md", import.meta.url),
    }),
  ],

  skills: [
    defineSkill({
      id: "labResource",
      title: l10n("skills.labResource.title", "Glass Lab Curator"),
      source: packageAsset("./skills/lab-resource", import.meta.url),
    }),
  ],
});

export default extension;
