import {
  defineExtension,
  defineHook,
  defineKeybinding,
  defineSchedule,
  defineSkill,
  packageAsset,
  sessionEvents,
} from "@pstdio/sdk/extensions";
import { commands } from "./src/commands";
import { navigationItems, navigationTrees, pages, viewMenus, views } from "./src/pages";
import { sessionEnded } from "./src/run-lifecycle";
import { settingProperties } from "./src/settings";
import { channelResource, postMedia, runResource, settingsSection, threadMedia, threadResource } from "./src/store";

export default defineExtension({
  commands: Object.values(commands),
  keybindings: [
    defineKeybinding({
      id: "keyboard-open",
      layer: "extensions",
      key: "O",
      sticky: true,
      action: { kind: "page", page: pages[0]!.ref },
    }),
    ...(
      [
        ["save-thread", "N"],
        ["run-daily", "R"],
        ["list-digest", "D"],
        ["set-thread-status", "S"],
        ["save-idea", "I"],
      ] as const
    ).map(([id, key]) =>
      defineKeybinding({
        id: `keyboard-${id}`,
        layer: "extensions",
        key,
        action: { kind: "command", target: { command: commands[id].ref } },
      }),
    ),
    ...(
      [
        ["set-current-thread-status", "S"],
        ["save-current-idea", "I"],
      ] as const
    ).map(([id, key]) =>
      defineKeybinding({
        id: `current-${id}`,
        layer: "current",
        key,
        targetScope: "resource",
        when: { resourceType: [threadResource.ref] },
        action: { kind: "command", target: { command: commands[id].ref } },
      }),
    ),
  ],
  settings: { properties: settingProperties },
  views,
  pages,
  viewMenus,
  navigationItems,
  navigationTrees,
  resourceKinds: [threadResource, runResource, settingsSection, channelResource],
  artifactMounts: [postMedia, threadMedia],
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
