import { qualifyRef } from "@pstdio/sdk/extensions";
import type { Instance } from "./instances";

const owner = "pocketcoder.pocketcoder";
export const instancesPageRef = qualifyRef(owner, { kind: "page", id: "instances" });
export const instancePageRef = qualifyRef(owner, { kind: "page", id: "instance" });
export const instanceTarget = (projectId: string, instance: Pick<Instance, "id" | "name">) => ({
  kind: "page" as const,
  page: instancePageRef,
  resource: { type: "instance", extensionId: owner, projectId, id: instance.id, label: instance.name, icon: "server" },
});
export const catalogPageRef = qualifyRef(owner, { kind: "page", id: "catalog" });
export const deployedPageRef = qualifyRef(owner, { kind: "page", id: "deployed" });
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
