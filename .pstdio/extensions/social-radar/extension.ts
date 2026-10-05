import {
  defineExtension,
  defineHook,
  defineSchedule,
  defineSkill,
  packageAsset,
  sessionEvents,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { navigationItems, navigationTrees, pages, viewMenus, views } from "./src/pages";
import { sessionEnded } from "./src/run-lifecycle";
import { settingProperties } from "./src/settings";
import { postMedia, runResource, settingsSection, threadResource } from "./src/store";

export default defineExtension({
  commands: Object.values(commands),
  settings: { properties: settingProperties },
  views,
  pages,
  viewMenus,
  navigationItems,
  navigationTrees,
  resourceKinds: [threadResource, runResource, settingsSection],
  artifactMounts: [postMedia],
  schedules: [
    defineSchedule({
      id: "daily-digest",
      title: "Social radar daily digest",
      schedule: "0 7 * * *",
      command: commands["run-daily"].ref,
    }),
  ],
  hooks: [
    defineHook({
      id: "research-failed",
      event: sessionEvents.failed,
      run: (ctx, event) => sessionEnded(ctx, event.sessionId, "Research session failed."),
    }),
    defineHook({
      id: "research-ended",
      event: sessionEvents.completed,
      run: (ctx, event) => sessionEnded(ctx, event.sessionId, "session ended without finish-run"),
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
