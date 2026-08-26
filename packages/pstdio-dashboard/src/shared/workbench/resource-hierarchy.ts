import type { ResourceRef, WorkbenchHierarchyNode, WorkbenchModuleContext } from "@pstdio/workbench";

export interface ExtensionResourceReference {
  type: string;
  id: string;
  label?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

export interface ExtensionViewParentReference {
  type: "view";
  viewId: string;
}

export type ExtensionHierarchyReference = ExtensionResourceReference | ExtensionViewParentReference;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textValue = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

export const normalizeExtensionResourceReference = (value: unknown): ExtensionResourceReference | undefined => {
  if (!isRecord(value)) return undefined;

  const type = textValue(value.type);
  const id = textValue(value.id);
  if (!type || !id) return undefined;

  const label = textValue(value.label);
  const icon = textValue(value.icon);
  const metadata = isRecord(value.metadata) ? value.metadata : undefined;

  return {
    type,
    id,
    ...(label ? { label } : {}),
    ...(icon ? { icon } : {}),
    ...(metadata ? { metadata } : {}),
  };
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
  reference: ExtensionResourceReference,
  input: DashboardResourceReferenceInput,
): ResourceRef => {
  return {
    kind: reference.type,
    uri: `dashboard-workbench://${reference.type}/${encodeURIComponent(reference.id)}`,
    id: reference.id,
    label: reference.label ?? reference.id,
    icon: reference.icon ?? input.fallbackIcon,
    metadata: {
      ...reference.metadata,
      projectId: input.projectId,
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
