import {
  defineExtension,
  defineHook,
  defineNavigationItem,
  definePage,
  defineSchedule,
  defineSettingsPanel,
  defineSettingsSection,
  defineSkill,
  defineView,
  packageAsset,
  sessionEvents,
  workbenchModes,
  workbenchSlots,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { sessionFailed } from "./src/run-lifecycle";
import { settingProperties } from "./src/settings";

const digest = defineView({
  id: "digest",
  title: "Social radar",
  icon: "radar",
  body: {
    kind: "webview",
    entry: packageAsset("./src/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "clipboard.write"],
  },
});
const settings = defineView({
  id: "settings",
  title: "Social radar settings",
  icon: "settings",
  body: {
    kind: "webview",
    entry: packageAsset("./src/settings-main.tsx", import.meta.url),
    capabilities: ["commands.execute"],
  },
});
const page = definePage({
  id: "digest",
  title: "Social radar",
  path: "social-radar",
  mode: workbenchModes.project,
  main: { kind: "view", view: digest.ref, cardinality: "one" },
  slots: [],
});
const section = defineSettingsSection({ id: "social-radar", title: "Social radar", order: 60 });
export default defineExtension({
  commands: Object.values(commands),
  settings: { properties: settingProperties },
  views: [digest, settings],
  pages: [page],
  settingsSections: [section],
  settingsPanels: [
    defineSettingsPanel({
      id: "settings",
      view: settings.ref,
      slot: workbenchSlots.projectSettings,
      section: section.ref,
    }),
  ],
  navigationItems: [
    defineNavigationItem({
      id: "digest",
      owner: workbenchModes.project,
      slot: "content",
      group: "Tools",
      label: "Social radar",
      icon: "radar",
      action: { kind: "page", page: page.ref },
    }),
  ],
  schedules: [
    defineSchedule({
      id: "daily-digest",
      title: "Social radar daily digest",
      schedule: "0 7 * * *",
      command: commands.runDaily.ref,
    }),
  ],
  hooks: [
    defineHook({
      id: "research-failed",
      event: sessionEvents.failed,
      run: (ctx, event) => sessionFailed(ctx, event.sessionId),
    }),
  ],
  skills: [
    defineSkill({
      id: "social-radar",
      title: "Social radar",
      source: packageAsset("./skills/social-radar", import.meta.url),
    }),
  ],
});
