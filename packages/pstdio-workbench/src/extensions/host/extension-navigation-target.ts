import type {
  NavigationTarget as ExtensionNavigationTarget,
  ResourceRef as ExtensionResourceRef,
  ResourceEmission,
} from "@pstdio/sdk/extensions";
import type { NavigationTarget, NavigationTargetItem } from "../../core/registries/navigation/navigation-registry";
import { FILE_SECTION_NAVIGATION_METADATA_KEY } from "../../core/registries/renderers/file-section-navigation";
import type { ResourceRef } from "../../core/registries/resources/resource-registry";
import { toWorkbenchResource } from "./workbench-extension-command";
import { metadataCommandId, metadataRefId } from "./workbench-extension-metadata-ref";

// Translates the extension contract's navigation targets and emissions into the host
// shapes. Pages are the only content destinations: a resource always travels as an
// argument, and a `section` deep link rides on the resource's metadata where the file
// renderer reads it.

export interface ToWorkbenchNavigationTargetInput {
  extensionId?: string;
  // Container context for section deep links (the tree or palette provider id and the
  // activated node), so the file renderer can scope the section to its origin.
  sectionSource?: { treeId: string; targetNodeId?: string };
  // Hosts canonicalize resources (native kinds have one canonical URI); defaults to
  // the extension-resource URI form.
  resolveResource?: (resource: ExtensionResourceRef) => ResourceRef;
  // Renderers may reroute command targets through their own runner command so the
  // command receives container context (tree id, node id).
  commandTargetOf?: (
    target: Extract<ExtensionNavigationTarget, { kind: "command" }>,
  ) => NavigationTargetItem | undefined;
}

interface SectionTarget {
  anchors: { id: string; heading: string; occurrence?: number }[];
}

const withSection = (
  resource: ResourceRef,
  section: SectionTarget | undefined,
  input: ToWorkbenchNavigationTargetInput,
): ResourceRef => {
  if (!section) return resource;
  return {
    ...resource,
    metadata: {
      ...resource.metadata,
      [FILE_SECTION_NAVIGATION_METADATA_KEY]: {
        ...(input.sectionSource ?? {}),
        anchors: section.anchors,
      },
    },
  };
};

export const toWorkbenchPageResource = (
  resource: ExtensionResourceRef,
  section: SectionTarget | undefined,
  input: ToWorkbenchNavigationTargetInput = {},
) => withSection((input.resolveResource ?? toWorkbenchResource)(resource), section, input);

export const isResourceEmission = (value: unknown): value is ResourceEmission =>
  typeof value === "object" &&
  value !== null &&
  !("kind" in value) &&
  "resource" in value &&
  typeof (value as { resource?: unknown }).resource === "object";

export const isExtensionNavigationTarget = (value: unknown): value is ExtensionNavigationTarget => {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === "page" || kind === "command" || kind === "href" || kind === "compound";
};

const toItem = (
  target: Exclude<ExtensionNavigationTarget, { kind: "compound" }>,
  input: ToWorkbenchNavigationTargetInput,
): NavigationTargetItem => {
  if (target.kind === "page") {
    const pageId = metadataRefId({ ...target.page, extensionId: target.page.extensionId ?? input.extensionId ?? "" });
    return {
      kind: "page",
      pageId,
      ...(target.resource ? { resource: toWorkbenchPageResource(target.resource, target.section, input) } : {}),
      ...(target.slot ? { slot: target.slot } : {}),
      ...(target.open ? { open: target.open } : {}),
    };
  }
  if (target.kind === "command") {
    const override = input.commandTargetOf?.(target);
    if (override) return override;
    const command = target.target.command;
    const commandId = metadataCommandId({ ...command, extensionId: command.extensionId ?? input.extensionId ?? "" });
    return { kind: "command", commandId, args: target.target.params };
  }
  return target;
};

export const toWorkbenchNavigationTarget = (
  target: ExtensionNavigationTarget,
  input: ToWorkbenchNavigationTargetInput = {},
): NavigationTarget => {
  if (target.kind === "compound") {
    return { kind: "compound", targets: target.targets.map((item) => toItem(item, input)) };
  }
  return toItem(target, input);
};

// Renderer activations return an emission, a navigation target, or nothing.
export const toWorkbenchActivationResult = (
  value: unknown,
  input: ToWorkbenchNavigationTargetInput = {},
):
  | { kind: "emission"; resource: ResourceRef; open?: "preview" | "pin" }
  | { kind: "target"; target: NavigationTarget }
  | undefined => {
  if (value === undefined || value === null) return undefined;
  if (isResourceEmission(value)) {
    return {
      kind: "emission",
      resource: toWorkbenchPageResource(value.resource, value.section, input),
      open: value.open,
    };
  }
  if (!isExtensionNavigationTarget(value)) {
    throw new Error("Renderer callback returned an invalid navigation target.");
  }
  return { kind: "target", target: toWorkbenchNavigationTarget(value, input) };
};
