import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ResourceRef } from "@pstdio/workbench";
import { resourceKindsFromMetadata } from "./resource-bindings";

const resourceKindFromMetadata = (metadata: WorkbenchExtensionMetadata) =>
  resourceKindsFromMetadata(metadata)[0] ??
  metadata.kanbanRenderers?.find((renderer) => renderer.resourceKind)?.resourceKind;

const ticketPreviewResource = () =>
  ({
    kind: "ticket",
    uri: "bench://ticket/PS-16",
    id: "PS-16",
    label: "PS-16 Tree renderer preview",
    icon: "FileText",
  }) satisfies ResourceRef;

export const createPreviewResource = (metadata: WorkbenchExtensionMetadata): ResourceRef => {
  const resourceKind = resourceKindFromMetadata(metadata);
  if (resourceKind === "ticket") return ticketPreviewResource();

  if (resourceKind) {
    return {
      kind: resourceKind,
      uri: `bench://${resourceKind}/preview`,
      id: "preview",
      label: `${resourceKind} preview`,
      icon: "FileText",
    };
  }

  return {
    kind: "extension-preview",
    uri: "bench://extension-preview/default",
    id: "preview",
    label: "Extension preview",
    icon: "FileText",
  };
};
