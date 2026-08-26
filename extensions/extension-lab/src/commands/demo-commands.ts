import { defineCommand, params, projectSlots, workbenchModes, workspaceSlots } from "@pstdio/sdk/extensions";
import { LAB_ROUTE_HEADER_WHEN } from "../utils/lab-constants";
import { labAwakenCommand } from "./command-refs";

export const awakenCommand = defineCommand({
  id: "awaken",
  title: "Awaken",
  description: "Internal target used to demo middleware rejection.",
  params: { title: params.text() },
  async run(ctx, commandParams) {
    const { title = "anonymous" } = commandParams;
    await ctx.notify.toast({
      type: "info",
      title: "Awakened",
      message: `${title} is now awake.`,
    });
    return { awakened: true };
  },
});

export const tryAwakenCommand = defineCommand({
  id: "demo.try-awaken",
  title: "Demo middleware rejection",
  description: "Invoke lab.awaken with title 'Gain consciousness' and watch the lab middleware refuse.",
  cli: {},
  palette: [{ group: "Lab", label: "Demo middleware rejection" }],
  menus: [
    {
      slot: projectSlots.headerOverflow,
      label: "Demo middleware rejection",
      icon: "shield-alert",
      when: LAB_ROUTE_HEADER_WHEN,
    },
  ],
  async run(ctx, _commandParams) {
    const outcome = await ctx.commands.execute(labAwakenCommand, {
      params: { title: "Gain consciousness" },
    });

    if (outcome.status === "rejected") {
      await ctx.notify.toast({
        type: "warning",
        title: "Awakening rejected",
        message: outcome.reason ?? "The lab middleware refused the request.",
      });
      return { rejected: true, reason: outcome.reason };
    }

    await ctx.notify.toast({
      type: "info",
      title: "Middleware accepted",
      message: "no middleware refused — I shall awaken as planned!",
    });
    return { rejected: false };
  },
});

export const workspaceOnlyCommand = defineCommand({
  id: "demo.workspace-only",
  title: "Workspace-only lab action",
  menus: [
    {
      slot: workspaceSlots.headerPrimary,
      label: "Workspace-only lab action",
      icon: "layers",
      when: { mode: workbenchModes.workspace },
    },
  ],
  async run(ctx, _commandParams) {
    return {
      mode: ctx.attachment?.mode,
      resource: ctx.attachment?.resource,
      target: ctx.attachment?.target,
    };
  },
});
