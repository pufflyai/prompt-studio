import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { createDashboardExtensionPanelResource } from "../extensions/extension-panel-resource";

export interface ExtensionResourceReference {
  type: string;
  id: string;
  label?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

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

export const dashboardResourceFromExtensionReference = (
  ctx: WorkbenchModuleContext,
  reference: ExtensionResourceReference,
  projectId: string,
): ResourceRef => {
  // Extension panels are browse roots with a canonical URI; a generic
  // dashboard-workbench://extension-view/... URI would give the same view a
  // second identity and break sidenav selection and breadcrumb sync.
  if (reference.type === "extension-view") {
    return createDashboardExtensionPanelResource({
      extensionId: textValue(reference.metadata?.extensionId) ?? "",
      icon: reference.icon,
      label: reference.label ?? reference.id,
      panelId: reference.id,
      projectId,
    });
  }

  return {
    kind: reference.type,
    uri: `dashboard-workbench://${reference.type}/${encodeURIComponent(reference.id)}`,
    id: reference.id,
    label: reference.label ?? reference.id,
    icon: reference.icon ?? ctx.resources.getKind(reference.type)?.icon,
    metadata: {
      ...reference.metadata,
      projectId,
    },
  };
};

export const dashboardResourceParent = (ctx: WorkbenchModuleContext, resource: ResourceRef, projectId: string) => {
  const reference = normalizeExtensionResourceReference(resource.metadata?.resourceParent);
  return reference ? dashboardResourceFromExtensionReference(ctx, reference, projectId) : undefined;
};
