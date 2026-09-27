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
import { settingsView } from "./src/settings-view";
import { threadResource } from "./src/thread-resource";
import { threadEditor, threadTable } from "./src/thread-views";

const digest = defineView({
  id: "digest",
  title: "Social radar",
  icon: "radar",
  body: {
    kind: "webview",
    entry: packageAsset("./src/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "clipboard.write", "navigation.open"],
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
const settingsPage = definePage({
  id: "settings",
  title: "Social radar settings",
  path: "social-radar/settings",
  mode: workbenchModes.project,
  parent: page.ref,
  main: { kind: "view", view: settingsView.ref, cardinality: "one" },
  slots: [],
});
const threadsPage = definePage({
  id: "threads",
  title: "Social radar threads",
  path: "social-radar/threads",
  mode: workbenchModes.project,
  parent: page.ref,
  main: { kind: "view", view: threadTable.ref, cardinality: "one" },
  slots: [],
});
const threadPage = definePage({
  id: "thread",
  title: "Social radar thread",
  path: "social-radar/thread",
  mode: workbenchModes.project,
  parent: threadsPage.ref,
  resource: { kinds: [threadResource.ref] },
  main: { kind: "view", view: threadEditor.ref, cardinality: "one" },
  slots: [],
});
const section = defineSettingsSection({ id: "social-radar", title: "Social radar", order: 60 });
export default defineExtension({
  commands: Object.values(commands),
  settings: { properties: settingProperties },
  views: [digest, settingsView, threadTable, threadEditor],
  pages: [page, settingsPage, threadsPage, threadPage],
  resourceKinds: [threadResource],
  settingsSections: [section],
  settingsPanels: [
    defineSettingsPanel({
      id: "settings",
      view: settingsView.ref,
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
    defineNavigationItem({
      id: "threads",
      owner: workbenchModes.project,
      slot: "content",
      group: "Tools",
      label: "Social radar threads",
      icon: "list",
      action: { kind: "page", page: threadsPage.ref },
    }),
    defineNavigationItem({
      id: "settings",
      owner: workbenchModes.project,
      slot: "content",
      group: "Tools",
      label: "Social radar settings",
      icon: "settings",
      action: { kind: "page", page: settingsPage.ref },
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
