import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ModePlacementContribution, ModeResourceRecipeContribution } from "@pstdio/sdk/extensions";
import { normalizeWorkbenchModePanels } from "pstdio-api-contracts/extension-kernel";
import { resolveContributionReference, resolveResourceKindReference } from "../../runtime/normalize/references";
import type { ExtensionRuntime, NormalizedExtension } from "../../types/runtime";

type ExtensionDiagnostic = WorkbenchExtensionMetadata["diagnostics"][number];
type ExtensionModeRecord = WorkbenchExtensionMetadata["modes"][number];

const reservedModeIds = new Set(["project-selection", "project", "workspace", "settings"]);

const resolveModeId = (mode: ExtensionRuntime["modes"][number]) =>
  typeof mode.contribution.id === "string" && mode.contribution.id.length > 0
    ? mode.contribution.id
    : `${mode.name}.${mode.localId}`;

const createLayoutDiagnostic = (
  mode: ExtensionRuntime["modes"][number],
  modeId: string,
  metadata: Record<string, unknown>,
): ExtensionDiagnostic => ({
  code: "extension_mode_layout_invalid",
  extensionId: mode.extensionId,
  message: `Extension "${mode.extensionId}" mode "${modeId}" declares an invalid layout`,
  metadata: { modeId, ...metadata },
  severity: "error",
  sourcePath: mode.sourcePath,
});

// Mode metadata crosses the API boundary, so panel references are serialized as fully
// namespaced ids: a bare reference resolves to the declaring extension and a namespaced
// one stays unchanged. Resource kind keys follow their own rule and keep the plain name
// the declaring extension gave the kind.
const declaringExtension = (mode: ExtensionRuntime["modes"][number]): NormalizedExtension =>
  ({ id: mode.extensionId, name: mode.name }) as NormalizedExtension;

const resolvePlacementMap = (
  ext: NormalizedExtension,
  placements: Record<string, ModePlacementContribution> | undefined,
) => {
  if (!placements) return undefined;
  return Object.fromEntries(
    Object.entries(placements).map(([panelId, placement]) => [resolveContributionReference(ext, panelId), placement]),
  );
};

const resolveModeResources = (
  ext: NormalizedExtension,
  resources: Record<string, ModeResourceRecipeContribution> | undefined,
  references: ReadonlyMap<string, string>,
) => {
  if (!resources) return undefined;
  return Object.fromEntries(
    Object.entries(resources).map(([kindId, recipe]) => [
      resolveResourceKindReference(kindId, references),
      { ...recipe, panels: resolvePlacementMap(ext, recipe.panels) },
    ]),
  );
};

const resolveDefaultResource = (
  ext: NormalizedExtension,
  defaultResource: ExtensionRuntime["modes"][number]["contribution"]["defaultResource"],
): NonNullable<ExtensionModeRecord["defaultResource"]> | undefined => {
  if (!defaultResource) return undefined;
  if ("type" in defaultResource) return defaultResource;
  if ("commandId" in defaultResource) {
    return { commandId: resolveContributionReference(ext, defaultResource.commandId) };
  }
  // A typed command ref serializes as a command id; functions never cross the API.
  return { commandId: resolveContributionReference(ext, defaultResource.id) };
};

export const toWorkbenchExtensionModeRecords = (
  runtime: ExtensionRuntime,
  resourceKindReferences: ReadonlyMap<string, string>,
) => {
  const modes: ExtensionModeRecord[] = [];
  const diagnostics: WorkbenchExtensionMetadata["diagnostics"] = [...runtime.diagnostics];
  const modeIds = new Set(reservedModeIds);

  for (const mode of runtime.modes) {
    const modeId = resolveModeId(mode);
    if (modeIds.has(modeId)) {
      diagnostics.push({
        code: "extension_mode_duplicate",
        extensionId: mode.extensionId,
        message: `Extension "${mode.extensionId}" declares duplicate workbench mode "${modeId}"`,
        metadata: { modeId },
        severity: "error",
        sourcePath: mode.sourcePath,
      });
      continue;
    }

    const { panels: panelRegions, invalid: invalidPanels } = normalizeWorkbenchModePanels(
      mode.contribution.panelRegions,
    );
    if (invalidPanels) {
      diagnostics.push(createLayoutDiagnostic(mode, modeId, { invalidPanelRegions: true }));
      continue;
    }

    modeIds.add(modeId);
    const ext = declaringExtension(mode);
    modes.push({
      id: mode.id,
      extensionId: mode.extensionId,
      modeId,
      label: mode.contribution.label,
      icon: mode.contribution.icon,
      ...(mode.contribution.panelRegions !== undefined ? { panelRegions } : {}),
      resources: resolveModeResources(
        ext,
        mode.contribution.resources,
        resourceKindReferences,
      ) as ExtensionModeRecord["resources"],
      modePanels: resolvePlacementMap(ext, mode.contribution.modePanels) as ExtensionModeRecord["modePanels"],
      defaultResource: resolveDefaultResource(ext, mode.contribution.defaultResource),
    });
  }

  return { diagnostics, modes };
};
