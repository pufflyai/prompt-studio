import {
  type CommandContext,
  defineCommand,
  defineHook,
  defineSchedule,
  type EventRef,
  type ExtensionContextBase,
  projectEvents,
  sessionEvents,
} from "@pstdio/sdk/extensions";
import { autoBuildCommand } from "../commands/auto-build";
import { checkAutoBuildProgress } from "../commands/auto-build-progress";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { withWriteGuard } from "../data/write-guard";
import { plannerTicketsChanged } from "../events";
import { planChanged } from "../timeline/contracts";

export const enqueueAutoBuild = (ctx: ExtensionContextBase) =>
  withWriteGuard(
    ctx,
    "auto-build-enqueue",
    async () => {
      if (!(await readAutoBuildMode(ctx)).enabled) return;
      const active = await ctx.automation.list({ status: ["queued", "running"] });
      if (active.some(({ commandId }) => commandId === `${ctx.extensionId}.command.${autoBuildCommand.id}`)) return;
      await ctx.automation.enqueue({
        command: autoBuildCommand.ref,
        input: {},
        key: `auto-build:${crypto.randomUUID()}`,
      });
    },
    () => undefined,
  );

export const checkAutoBuildCommand = defineCommand({
  id: "auto-build.check",
  title: "Check Auto build",
  async run(ctx: CommandContext) {
    await checkAutoBuildProgress(ctx);
  },
});

export const autoBuildSchedule = defineSchedule({
  id: "auto-build",
  title: "Check Auto build",
  schedule: "*/3 * * * *",
  command: checkAutoBuildCommand.ref,
});

const checkAfter = <T extends object>(id: string, event: EventRef<T>) =>
  defineHook({
    id: `auto-build.${id}`,
    event,
    async run(ctx) {
      await enqueueAutoBuild(ctx);
    },
  });

export const autoBuildSessionCompletedHook = defineHook({
  id: "auto-build.session-completed",
  event: sessionEvents.completed,
  async run(ctx, { sessionId }) {
    if ((await readAutoBuildSupervisor(ctx)).sessionId === sessionId) return;
    await enqueueAutoBuild(ctx);
  },
});

export const autoBuildHooks = [
  checkAfter("tickets-changed", plannerTicketsChanged),
  checkAfter("plan-changed", planChanged),
  autoBuildSessionCompletedHook,
  checkAfter("project-opened", projectEvents.opened),
];
