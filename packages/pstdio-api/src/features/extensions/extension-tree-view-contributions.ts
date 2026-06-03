import { getWorkbenchTargetDefinition, type WorkbenchContributionKind, workbenchTargets } from "@pstdio/sdk/extensions";
import type { ExtensionsCheckResponse, ExtensionTreeRendererRecord, ExtensionViewRecord } from "pstdio-api-contracts";
import { addDiagnostic, commandIdFromRef, isRecord, slotId } from "./extension-diagnostics";
import type { LoadedExtension } from "./extension-runtime";

const supportedTargetsFor = (kind: WorkbenchContributionKind) =>
  workbenchTargets
    .filter((target) => (target.allowedKinds as readonly WorkbenchContributionKind[]).includes(kind))
    .map((target) => target.id);

const localizableString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (!isRecord(value) || typeof value.$l10n !== "string") return undefined;
  return typeof value.default === "string" ? value.default : value.$l10n;
};

const displayString = (value: unknown, fallback: string) => localizableString(value) ?? fallback;

const resolveContributionId = (extensionName: string, localOrFullId: string) =>
  localOrFullId.startsWith(`${extensionName}.`) ? localOrFullId : `${extensionName}.${localOrFullId}`;

const stringValue = (value: unknown) => (typeof value === "string" ? value : undefined);

const commandExists = (loaded: LoadedExtension, commandId: string) => {
  if (!commandId.startsWith(`${loaded.metadata.name}.`)) return true;
  const localId = commandId.slice(loaded.metadata.name.length + 1);
  return isRecord(loaded.definition.commands) && isRecord(loaded.definition.commands[localId]);
};

const treeRendererCommandId = (loaded: LoadedExtension, value: unknown) => {
  const commandId = commandIdFromRef(value);
  if (!commandId || !commandExists(loaded, commandId)) return undefined;
  return commandId;
};

const modeLayoutViewKeys = (loaded: LoadedExtension) => {
  const modes = loaded.definition.modes;
  const keys = new Set<string>();
  if (!isRecord(modes)) return keys;

  for (const mode of Object.values(modes)) {
    if (!isRecord(mode) || !isRecord(mode.layout) || !Array.isArray(mode.layout.open)) continue;
    for (const entry of mode.layout.open) {
      if (isRecord(entry) && typeof entry.view === "string") keys.add(entry.view);
    }
  }

  return keys;
};

const isCollectableView = (
  key: string,
  view: unknown,
  referencedByModeLayout: Set<string>,
): view is Record<string, unknown> => {
  if (!isRecord(view) || !localizableString(view.title)) return false;
  return Boolean(view.target || view.slot || view.resourceKind || referencedByModeLayout.has(key));
};

const reportInvalidTreeRenderer = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  contributionId: string,
) => {
  addDiagnostic(check, {
    code: "invalid_tree_renderer",
    extensionId: loaded.metadata.id,
    message: `Tree renderer "${contributionId}" must define title and a valid bodyCommand`,
    severity: "error",
    sourcePath,
    metadata: { contributionId },
  });
};

const treeRendererRecord = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  key: string,
  renderer: unknown,
): ExtensionTreeRendererRecord | undefined => {
  const id = `${loaded.metadata.name}.${key}`;
  if (!isRecord(renderer) || !localizableString(renderer.title)) {
    reportInvalidTreeRenderer(check, loaded, sourcePath, id);
    return undefined;
  }

  const bodyCommandId = treeRendererCommandId(loaded, renderer.bodyCommand);
  const childrenCommandId =
    renderer.childrenCommand === undefined ? undefined : treeRendererCommandId(loaded, renderer.childrenCommand);
  const footerCommandId =
    renderer.footerCommand === undefined ? undefined : treeRendererCommandId(loaded, renderer.footerCommand);

  if (
    !bodyCommandId ||
    (renderer.childrenCommand !== undefined && !childrenCommandId) ||
    (renderer.footerCommand !== undefined && !footerCommandId)
  ) {
    reportInvalidTreeRenderer(check, loaded, sourcePath, id);
    return undefined;
  }

  return {
    id,
    extensionId: loaded.metadata.id,
    title: displayString(renderer.title, key),
    icon: stringValue(renderer.icon),
    bodyCommandId,
    childrenCommandId,
    footerCommandId,
    defaultExpandedSectionIds: Array.isArray(renderer.defaultExpandedSectionIds)
      ? renderer.defaultExpandedSectionIds.filter((value): value is string => typeof value === "string")
      : undefined,
    defaultExpandedNodeIds: Array.isArray(renderer.defaultExpandedNodeIds)
      ? renderer.defaultExpandedNodeIds.filter((value): value is string => typeof value === "string")
      : undefined,
  };
};

export const collectTreeRenderers = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const renderers = loaded.definition.treeRenderers;
  if (!isRecord(renderers)) return;

  for (const [key, renderer] of Object.entries(renderers)) {
    const record = treeRendererRecord(check, loaded, sourcePath, key, renderer);
    if (record) check.treeRenderers.push(record);
  }
};

const resolveTreeRendererId = (check: ExtensionsCheckResponse, loaded: LoadedExtension, localOrFullId: string) => {
  const id = resolveContributionId(loaded.metadata.name, localOrFullId);
  return check.treeRenderers.some((renderer) => renderer.id === id && renderer.extensionId === loaded.metadata.id)
    ? id
    : undefined;
};

const reportInvalidViewBody = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  id: string,
) => {
  addDiagnostic(check, {
    code: "extension_view_body_invalid",
    extensionId: loaded.metadata.id,
    message: `View "${id}" must declare either webview or treeRenderer`,
    severity: "error",
    sourcePath,
    metadata: { contributionId: id },
  });
};

const reportMissingTreeRenderer = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  id: string,
  treeRenderer: string,
) => {
  addDiagnostic(check, {
    code: "extension_view_tree_renderer_missing",
    extensionId: loaded.metadata.id,
    message: `View "${id}" references unknown tree renderer "${treeRenderer}"`,
    severity: "error",
    sourcePath,
    metadata: { contributionId: id, treeRenderer },
  });
};

const resolveViewBody = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  id: string,
  view: Record<string, unknown>,
) => {
  const hasWebview = isRecord(view.webview);
  const treeRenderer = typeof view.treeRenderer === "string" ? view.treeRenderer : undefined;
  if (hasWebview === Boolean(treeRenderer)) {
    reportInvalidViewBody(check, loaded, sourcePath, id);
    return null;
  }

  if (!treeRenderer) return { webview: view.webview as ExtensionViewRecord["webview"] };

  const treeRendererId = resolveTreeRendererId(check, loaded, treeRenderer);
  if (!treeRendererId) {
    reportMissingTreeRenderer(check, loaded, sourcePath, id, treeRenderer);
    return null;
  }

  return { treeRendererId };
};

const hasCompatibleViewTarget = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  contributionId: string,
  target: unknown,
) => {
  const expectedKind = "view";
  if (typeof target !== "string") return true;

  const definition = getWorkbenchTargetDefinition(target);
  if (!definition) {
    addDiagnostic(check, {
      code: "extension_target_invalid",
      extensionId: loaded.metadata.id,
      message: `Contribution "${contributionId}" targets unknown workbench target "${target}"`,
      severity: "error",
      sourcePath,
      metadata: { contributionId, expectedKind, supportedTargets: supportedTargetsFor(expectedKind), target },
    });
    return false;
  }

  if ((definition.allowedKinds as readonly WorkbenchContributionKind[]).includes(expectedKind)) return true;

  addDiagnostic(check, {
    code: "extension_target_unsupported",
    extensionId: loaded.metadata.id,
    message: `Contribution "${contributionId}" targets "${target}" as ${expectedKind}; supported targets are ${supportedTargetsFor(expectedKind).join(", ")}`,
    severity: "error",
    sourcePath,
    metadata: { contributionId, expectedKind, supportedTargets: supportedTargetsFor(expectedKind), target },
  });
  return false;
};

const viewSlotId = (view: Record<string, unknown>) => {
  if (view.slot !== undefined) return slotId(view.slot);
  if (typeof view.target === "string") return view.target;
  return "unknown";
};

const viewTarget = (view: Record<string, unknown>) => {
  if (typeof view.target !== "string") return undefined;
  return view.target as ExtensionViewRecord["target"];
};

const viewSurface = (view: Record<string, unknown>) => {
  if (view.surface === "panel" || view.surface === "modal") return view.surface;
  return undefined;
};

const viewPlacement = (view: Record<string, unknown>) => {
  if (view.placement === "first" || view.placement === "default" || view.placement === "last") {
    return view.placement;
  }
  return undefined;
};

const toViewRecord = (
  id: string,
  loaded: LoadedExtension,
  key: string,
  view: Record<string, unknown>,
  body: NonNullable<ReturnType<typeof resolveViewBody>>,
): ExtensionViewRecord => ({
  id,
  extensionId: loaded.metadata.id,
  slotId: viewSlotId(view),
  target: viewTarget(view),
  title: displayString(view.title, key),
  group: typeof view.group === "string" ? view.group : undefined,
  resourceKind: typeof view.resourceKind === "string" ? view.resourceKind : undefined,
  surface: viewSurface(view),
  placement: viewPlacement(view),
  ...("webview" in body ? { webview: body.webview } : {}),
  ...("treeRendererId" in body ? { treeRendererId: body.treeRendererId } : {}),
});

const collectView = (
  check: ExtensionsCheckResponse,
  loaded: LoadedExtension,
  sourcePath: string,
  key: string,
  view: Record<string, unknown>,
) => {
  const id = `${loaded.metadata.name}.${key}`;
  const body = resolveViewBody(check, loaded, sourcePath, id, view);
  if (!body || !hasCompatibleViewTarget(check, loaded, sourcePath, id, view.target)) return;
  check.views.push(toViewRecord(id, loaded, key, view, body));
};

export const collectViews = (check: ExtensionsCheckResponse, loaded: LoadedExtension, sourcePath: string) => {
  const views = loaded.definition.views;
  if (!isRecord(views)) return;
  const referencedByModeLayout = modeLayoutViewKeys(loaded);

  for (const [key, view] of Object.entries(views)) {
    if (!isCollectableView(key, view, referencedByModeLayout)) continue;
    collectView(check, loaded, sourcePath, key, view);
  }
};
