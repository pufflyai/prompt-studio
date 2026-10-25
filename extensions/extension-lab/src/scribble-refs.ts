import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const scribbleDocumentPage = { kind: "page", id: "scribble-resource" } as const;
export const scribbleDraftPage = { kind: "page", id: "scribble-draft" } as const;
export const scribbleDraftKind = { kind: "resource-kind", id: "scribble.draft" } as const;
export const scribbleResource = (
  id: string,
  label: string,
  ctx: Pick<ExtensionContextBase, "extensionId" | "projectId">,
) => ({
  type: "scribble.document",
  id,
  label,
  extensionId: ctx.extensionId,
  projectId: ctx.projectId,
});
export const scribbleDraftResource = (id: string, ctx: Pick<ExtensionContextBase, "extensionId" | "projectId">) => ({
  type: scribbleDraftKind.id,
  id,
  label: "New page",
  extensionId: ctx.extensionId,
  projectId: ctx.projectId,
});
