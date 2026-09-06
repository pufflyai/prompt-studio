import type { ResourceRef, WorkbenchHierarchyNode, WorkbenchModuleContext } from "@pstdio/workbench";
import { extensionResourceRefSchema } from "pstdio-api-contracts";

export interface ExtensionViewParentReference {
  type: "view";
  viewId: string;
}
export type ExtensionHierarchyReference = ResourceRef | ExtensionViewParentReference;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const textValue = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);
export const normalizeExtensionResourceReference = (value: unknown) => {
  const result = extensionResourceRefSchema.safeParse(value);
  return result.success ? result.data : undefined;
};
export const normalizeExtensionHierarchyReference = (value: unknown): ExtensionHierarchyReference | undefined => {
  if (!isRecord(value)) return undefined;
  if (value.type === "view") {
    const viewId = textValue(value.viewId);
    return viewId ? { type: "view", viewId } : undefined;
  }
  return normalizeExtensionResourceReference(value);
};
export interface DashboardResourceReferenceInput {
  projectId: string;
  /** Icon used when the reference declares none (e.g. the registered kind's icon). */
  fallbackIcon?: string;
}
export const dashboardResourceFromExtensionReference = (
  reference: ResourceRef,
  input: DashboardResourceReferenceInput,
): ResourceRef => {
  return {
    ...reference,
    label: reference.label ?? reference.id,
    icon: reference.icon ?? input.fallbackIcon,
    metadata: {
      ...reference.metadata,
      projectId: reference.projectId ?? input.projectId,
    },
  };
};
export const dashboardResourceParent = (
  ctx: WorkbenchModuleContext,
  resource: ResourceRef,
  projectId: string,
): WorkbenchHierarchyNode | undefined => {
  const reference = normalizeExtensionHierarchyReference(resource.metadata?.resourceParent);
  if (!reference) return undefined;
  if ("viewId" in reference) return reference;
  return dashboardResourceFromExtensionReference(reference, {
    projectId,
    fallbackIcon: ctx.resources.getKind(reference.type)?.icon,
  });
};
