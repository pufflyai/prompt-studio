import { defineCommand, defineSettingsPanel, defineView, params, workbenchSlots } from "@pstdio/sdk/extensions";
import { capacityControls } from "./capacity-controls";
import { changed, refreshEvents } from "./events";
import { readDevices } from "./query";

export const setLimit = defineCommand({
  id: "set-limit",
  title: "Set this device's workspace limit",
  cli: true,
  mutating: true,
  params: { limit: params.number(), unlimited: params.boolean() },
  async run(ctx, args) {
    const limit = args.unlimited ? null : args.limit;
    if (limit !== null && (!Number.isInteger(limit) || !limit || limit < 1))
      throw new Error("Enter a positive whole-number limit, or choose unlimited.");
    const result = await ctx.workspaces.updateCapacity({ limit: limit! });
    await ctx.events.emit(changed, {});
    return result;
  },
});
export const capacityView = defineView({
  id: "device-capacity",
  title: "Workspaces",
  body: {
    kind: "controls",
    refreshEvents,
    async query(ctx, { renderer }) {
      const { local, devices } = await readDevices(ctx);
      const deviceId =
        typeof renderer.pageParams?.["device-id"] === "string" ? renderer.pageParams["device-id"] : local.deviceId;
      let device = devices.find((device) => device.id === deviceId);
      if (!device && deviceId !== local.deviceId) {
        const workspace = (await ctx.workspaces.list()).find((workspace) => workspace.device?.id === deviceId);
        if (workspace?.device)
          device = {
            id: deviceId,
            name: workspace.device.name,
            current: false,
            online: false,
            lastSeenAt: workspace.updatedAt ?? "",
          };
      }
      const current = deviceId === local.deviceId;
      let capacity = current ? local : undefined;
      if (!current && device?.online)
        try {
          capacity = await ctx.workspaces.getCapacity({ deviceId });
        } catch {
          /* Show unavailable counts, never infer them from history. */
        }
      const snapshots = ((await ctx.settings.get("deviceLimits")) ?? {}) as Record<string, number | null>;
      if (capacity && snapshots[deviceId] !== capacity.limit)
        await ctx.settings.set("deviceLimits", { ...snapshots, [deviceId]: capacity.limit });
      const fields = capacityControls({
        current,
        name: device?.name ?? (current ? local.deviceName : "Unknown device"),
        online: device?.online ?? current,
        lastSeenAt: device?.lastSeenAt,
        capacity,
        lastLimit: snapshots[deviceId],
      });
      return { params: fields, readOnly: !current };
    },
    async onApply(ctx, { renderer, values }) {
      const local = await ctx.workspaces.getCapacity();
      if (renderer.pageParams?.["device-id"] && renderer.pageParams["device-id"] !== local.deviceId)
        throw new Error("Device limits can only be changed on that device.");
      const limit = values.unlimited ? null : Number(values.limit);
      if (limit !== null && (!Number.isInteger(limit) || limit < 1))
        throw new Error("Enter a positive whole-number limit.");
      await ctx.workspaces.updateCapacity({ limit });
      await ctx.events.emit(changed, {});
    },
  },
});
export const capacitySettings = defineSettingsPanel({
  id: "workspaces",
  title: "Workspaces",
  icon: "folder-git-2",
  slot: workbenchSlots.globalSettings,
  view: capacityView.ref,
});
