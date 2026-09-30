import { defineResourceKind, type NavigationTarget, type ResourceRef } from "@pstdio/sdk/extensions";
export const animation = defineResourceKind({ id: "motion-lab.animation", label: "Animation", icon: "film" });
export const resource = (id: string, projectId?: string, title?: string) =>
  ({ type: animation.ref.id, id, label: title, extensionId: "pstdio.motion-lab", projectId }) satisfies ResourceRef;
export const target = (id: string, projectId?: string, title?: string) =>
  ({
    kind: "page",
    page: { kind: "page", id: "animation" },
    resource: resource(id, projectId, title),
  }) satisfies NavigationTarget;
