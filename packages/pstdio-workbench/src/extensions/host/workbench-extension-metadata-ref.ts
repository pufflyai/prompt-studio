import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ContributionKind } from "@pstdio/sdk/extensions";

export type MetadataRef = { extensionId: string; kind: ContributionKind; id: string };

export const metadataRefId = (ref: MetadataRef) =>
  ref.extensionId === "pstdio" ? ref.id : `${ref.extensionId}.${ref.kind}.${ref.id}`;

export const metadataCommandId = (ref: { extensionId: string; id: string }) =>
  ref.extensionId === "pstdio" ? ref.id : `${ref.extensionId}.command.${ref.id}`;

export const toInternalWhen = (
  when:
    | WorkbenchExtensionMetadata["navigationItems"][number]["when"]
    | WorkbenchExtensionMetadata["statusBarItems"][number]["when"],
) => {
  if (!when) return undefined;
  const ids = (value: MetadataRef | MetadataRef[] | undefined) => {
    if (!value) return undefined;
    return Array.isArray(value) ? value.map(metadataRefId) : metadataRefId(value);
  };
  return {
    mode: ids(when.mode as MetadataRef | MetadataRef[] | undefined),
    source: when.source,
    viewId: ids(when.view as MetadataRef | MetadataRef[] | undefined),
    resourceType: when.resourceType?.map((ref) => ref.id),
    metadata: when.metadata,
  };
};

export const toWorkbenchWhenExpression = toInternalWhen;
