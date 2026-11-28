import { type ExtensionContextBase, qualifyRef, type ResourceRef } from "@pstdio/sdk/extensions";
import type { Instance } from "./instances";
import { deployedInstanceKind } from "./resources";

const owner = "pocketcoder.pocketcoder";
export const deployedConnectionId = "deployed-controller";
export const instancesPageRef = qualifyRef(owner, { kind: "page", id: "instances" });
export const instancePageRef = qualifyRef(owner, { kind: "page", id: "instance" });
export const instanceTarget = (projectId: string, instance: Pick<Instance, "id" | "name">) => ({
  kind: "page" as const,
  page: instancePageRef,
  resource: { type: "instance", extensionId: owner, projectId, id: instance.id, label: instance.name, icon: "server" },
});
export const catalogPageRef = qualifyRef(owner, { kind: "page", id: "catalog" });
export const deployedPageRef = qualifyRef(owner, { kind: "page", id: "deployed" });
export const deployedInstanceResource = (ctx: Pick<ExtensionContextBase, "extensionId" | "projectId">, label: string) =>
  ({
    type: deployedInstanceKind.id,
    extensionId: ctx.extensionId,
    projectId: ctx.projectId,
    id: deployedConnectionId,
    label,
    icon: "cloud",
  }) satisfies ResourceRef;
export const deployedInstanceTarget = (
  ctx: Pick<ExtensionContextBase, "extensionId" | "projectId">,
  label: string,
) => ({ kind: "page" as const, page: deployedPageRef, resource: deployedInstanceResource(ctx, label) });
export const deployedMachinePageRef = qualifyRef(owner, { kind: "page", id: "deployed-machine" });
export const templatePageRef = qualifyRef(owner, { kind: "page", id: "template" });
export const templateTarget = (projectId: string, path: string) => ({
  kind: "page" as const,
  page: templatePageRef,
  resource: {
    type: "template",
    extensionId: owner,
    projectId,
    id: path,
    label: path.split("/").pop() ?? path,
    icon: "package",
  },
});
