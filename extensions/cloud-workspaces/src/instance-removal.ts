import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { instancesFor } from "./instances";
import { instancesPageRef } from "./lab-navigation";
import { changed, instanceKind } from "./resources";

export function createRemoveInstance(getInstances = instancesFor) {
  return defineCommand({
    id: "instances.remove",
    title: l10n("cloud-workspaces.remove-instance", "Remove instance"),
    cli: true,
    mutating: true,
    params: {
      instanceId: params.text({ label: l10n("cloud-workspaces.instance-id", "Instance ID"), resolvedFrom: "resource" }),
    },
    async run(ctx, input) {
      const instanceId = input.instanceId ?? (ctx.resource?.type === instanceKind.id ? ctx.resource.id : undefined);
      if (!instanceId) throw new Error("Choose a PocketCoder instance.");
      await getInstances(ctx.projectId).remove(instanceId);
      if ((await ctx.storage.get<string>("selected-instance")) === instanceId) {
        await ctx.storage.delete("selected-instance");
        ctx.navigation.open({ kind: "page", page: instancesPageRef });
      }
      await ctx.resources.removed({
        type: instanceKind.id,
        id: instanceId,
        extensionId: ctx.extensionId,
        projectId: ctx.projectId,
      });
      await ctx.events.emit(changed, {});
      return { instanceId, removed: true };
    },
  });
}

export const removeInstance = createRemoveInstance();
