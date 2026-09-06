import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ResourceRef } from "@pstdio/workbench";
import { resourceKindsFromMetadata } from "./resource-bindings";

const resourceKindFromMetadata = (metadata: WorkbenchExtensionMetadata) => resourceKindsFromMetadata(metadata)[0];

const ticketPreviewResource = () =>
  ({
    type: "ticket",
    id: "PS-16",
    label: "PS-16 Tree renderer preview",
    icon: "FileText",
  }) satisfies ResourceRef;

export const createPreviewResource = (metadata: WorkbenchExtensionMetadata): ResourceRef => {
  const resourceKind = resourceKindFromMetadata(metadata);
  if (resourceKind === "ticket") return ticketPreviewResource();

  if (resourceKind) {
    return {
      type: resourceKind,
      id: "preview",
      label: `${resourceKind} preview`,
      icon: "FileText",
    };
  }

  return {
    type: "extension-preview",
    id: "preview",
    label: "Extension preview",
    icon: "FileText",
  };
};
