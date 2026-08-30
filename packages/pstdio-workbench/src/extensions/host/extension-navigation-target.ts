import type {
  NavigationTarget as ExtensionNavigationTarget,
  ExtensionPlacementStrategy,
  ResourceRef as ExtensionResourceRef,
  ResourceEmission,
} from "@pstdio/sdk/extensions";
import type {
  NavigationTarget,
  NavigationTargetCommand,
  NavigationTargetItem,
} from "../../core/registries/navigation/navigation-registry";
import { FILE_SECTION_NAVIGATION_METADATA_KEY } from "../../core/registries/renderers/file-section-navigation";
import type { ResourceRef } from "../../core/registries/resources/resource-registry";
import { toWorkbenchResource } from "./workbench-extension-command";
import { metadataCommandId, metadataRefId } from "./workbench-extension-metadata-ref";

// Translates the extension contract's navigation targets and emissions into host
// shapes. Resource and view targets stay available during the page API rollout.

export interface ToWorkbenchNavigationTargetInput {
  commandIdOf?(
    command: Extract<ExtensionNavigationTarget, { kind: "command" }>["target"]["command"],
  ): string | undefined;
  extensionId?: string;
  // Container context for section deep links (the tree or palette provider id and the
  // activated node), so the file renderer can scope the section to its origin.
  sectionSource?: { treeId: string; targetNodeId?: string };
  // Hosts canonicalize resources (native kinds have one canonical URI); defaults to
  // the extension-resource URI form.
  resolveResource?: (resource: ExtensionResourceRef) => ResourceRef;
  resourceOf?(
    resource: ExtensionResourceRef,
    target: Extract<ExtensionNavigationTarget, { kind: "resource" }>,
  ): ResourceRef;
  sourcePlacement?: { instanceId: string };
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isContributionRef = (value: unknown, kind: string) =>
  isRecord(value) && value.kind === kind && typeof value.id === "string";

const isResource = (value: unknown) =>
  isRecord(value) && typeof value.type === "string" && typeof value.id === "string";

const hasSupportedStrategy = (value: unknown, strategies: readonly unknown[]) => {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return value.strategy === undefined || strategies.includes(value.strategy);
};

const isItemTarget = (value: unknown): value is Exclude<ExtensionNavigationTarget, { kind: "compound" }> => {
  if (!isRecord(value)) return false;
  if (value.kind === "resource") {
    return isResource(value.resource) && hasSupportedStrategy(value.input, ["persistent", "replace-active"]);
  }
  if (value.kind === "view") {
    return (
      isContributionRef(value.view, "view") &&
      hasSupportedStrategy(value.input, ["persistent", "preview", "replace-active", "replace-invoking"])
    );
  }
  if (value.kind === "page") {
    return (
      isContributionRef(value.page, "page") &&
      (value.resource === undefined || isResource(value.resource)) &&
      (value.slot === undefined || typeof value.slot === "string") &&
      (value.open === undefined || value.open === "preview" || value.open === "pin")
    );
  }
  if (value.kind === "href") return typeof value.href === "string";
  return (
    value.kind === "command" &&
    isRecord(value.target) &&
    isContributionRef(value.target.command, "command") &&
    (value.target.params === undefined || isRecord(value.target.params))
  );
};

export const isExtensionNavigationTarget = (value: unknown): value is ExtensionNavigationTarget => {
  if (isItemTarget(value)) return true;
  return (
    isRecord(value) &&
    value.kind === "compound" &&
    Array.isArray(value.targets) &&
    value.targets.length > 0 &&
    value.targets.every(isItemTarget)
  );
};

const toResourceInput = (strategy: "persistent" | "replace-active" | undefined) => {
  if (!strategy || strategy === "persistent") return {};
  return { replaceActive: true };
};

const toViewInput = (
  input: { strategy?: ExtensionPlacementStrategy } | undefined,
  sourcePlacement: { instanceId: string } | undefined,
) => {
  const strategy = input?.strategy;
  if (!strategy) return {};
  if (strategy === "persistent" || strategy === "preview" || strategy === "replace-active") {
    return { strategy: { kind: strategy } } as const;
  }
  if (!sourcePlacement) throw new Error("replace-invoking requires a live source placement.");
  return { strategy: { kind: "replace-panel", instanceId: sourcePlacement.instanceId } } as const;
};

const toPageTarget = (
  target: Extract<ExtensionNavigationTarget, { kind: "page" }>,
  input: ToWorkbenchNavigationTargetInput,
): NavigationTargetItem => {
  const pageId = metadataRefId({ ...target.page, extensionId: target.page.extensionId ?? input.extensionId ?? "" });
  return {
    kind: "page",
    pageId,
    ...(target.resource ? { resource: toWorkbenchPageResource(target.resource, target.section, input) } : {}),
    ...(target.slot ? { slot: target.slot } : {}),
    ...(target.open ? { open: target.open } : {}),
  };
};

const toItem = (
  target: Exclude<ExtensionNavigationTarget, { kind: "compound" }>,
  input: ToWorkbenchNavigationTargetInput,
): NavigationTargetItem => {
  if (target.kind === "page") return toPageTarget(target, input);
  if (target.kind === "resource") {
    if (target.section && !input.resourceOf) {
      throw new Error("Resource targets with a section need a resourceOf translator that encodes the section.");
    }
    return {
      kind: "resource",
      resource: input.resourceOf ? input.resourceOf(target.resource, target) : toWorkbenchResource(target.resource),
      input: toResourceInput(target.input?.strategy),
    };
  }
  if (target.kind === "view") {
    const extensionId = target.view.extensionId ?? input.extensionId ?? "";
    return {
      kind: "view",
      viewId: metadataRefId({ ...target.view, extensionId }),
      input: toViewInput(target.input, input.sourcePlacement),
    };
  }
  if (target.kind === "command") {
    const override = input.commandTargetOf?.(target);
    if (override) return override;
    const command = target.target.command;
    const extensionId = command.extensionId ?? input.extensionId ?? "";
    const commandId = input.commandIdOf?.(command) ?? metadataCommandId({ ...command, extensionId });
    return { kind: "command", commandId, args: target.target.params } satisfies NavigationTargetCommand;
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

export const toWorkbenchNavigationTargetResult = (
  value: unknown,
  input: ToWorkbenchNavigationTargetInput = {},
): NavigationTarget | undefined => {
  if (value === undefined || value === null) return undefined;
  if (!isExtensionNavigationTarget(value)) throw new Error("Renderer callback returned an invalid navigation target.");
  return toWorkbenchNavigationTarget(value, input);
};
