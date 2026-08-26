import { defineCommand, projectSlots, workbenchModes, workspaceSlots } from "@pstdio/sdk/extensions";
import { LAB_ROUTE_HEADER_WHEN } from "../utils/lab-constants";
import { awakenCommand } from "./awaken-command";

export const tryAwakenCommand = defineCommand({
  id: "demo.try-awaken",
  title: "Demo middleware rejection",
  description: "Invoke lab.awaken with title 'Gain consciousness' and watch the lab middleware refuse.",
  cli: true,
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
    const outcome = await ctx.commands.execute(awakenCommand.ref, {
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
