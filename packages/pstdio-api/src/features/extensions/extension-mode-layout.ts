import type { ExtensionDiagnostic, ModeLayoutContributionRecord } from "pstdio-api-contracts";
import { normalizeWorkbenchModePanels, workbenchRegions } from "pstdio-api-contracts/extension-kernel";
import { isRecord } from "./extension-diagnostics";

export const reservedDashboardModeIds = new Set(["project-selection", "project", "workspace", "settings"]);

type ModeLayoutRegion = NonNullable<ModeLayoutContributionRecord["open"]>[number]["region"];

export const isSafeModeLayoutRegion = (region: unknown): region is ModeLayoutRegion =>
  typeof region === "string" && (workbenchRegions as readonly string[]).includes(region);

export const resolveModeId = (input: { extensionName: string; localId: string; id?: unknown }) =>
  typeof input.id === "string" && input.id.length > 0 ? input.id : `${input.extensionName}.${input.localId}`;

interface NormalizeModeLayoutInput {
  extensionId: string;
  extensionName: string;
  modeId: string;
  layout: unknown;
  sourcePath?: string;
  panelIdsByLocalId: Map<string, string>;
}

const createInvalidLayoutDiagnostic = (
  input: NormalizeModeLayoutInput,
  metadata: Record<string, unknown>,
): ExtensionDiagnostic => ({
  code: "extension_mode_layout_invalid",
  extensionId: input.extensionId,
  message: `Extension "${input.extensionId}" mode "${input.modeId}" declares an invalid layout`,
  metadata: { modeId: input.modeId, ...metadata },
  severity: "error",
  sourcePath: input.sourcePath,
});

const resolvePanelId = (panel: string, input: NormalizeModeLayoutInput) => {
  const localPanelId = input.panelIdsByLocalId.get(panel);
  if (localPanelId) return localPanelId;

  const extensionPrefix = `${input.extensionName}.`;
  if (panel.startsWith(extensionPrefix) && [...input.panelIdsByLocalId.values()].includes(panel)) return panel;

  return undefined;
};

type ModeLayoutOpenEntry = NonNullable<ModeLayoutContributionRecord["open"]>[number];

const modePanelForRegion = (region: ModeLayoutRegion) => {
  if (region === "main" || region === "main-header") return "main";
  if (region === "secondary" || region === "secondary-header") return "secondary";
  if (region === "side" || region === "side-header") return "side";
  return undefined;
};

const normalizeOpenEntry = (
  entry: unknown,
  input: NormalizeModeLayoutInput,
  panels: NonNullable<ModeLayoutContributionRecord["panels"]>,
) => {
  if (!isRecord(entry) || !isSafeModeLayoutRegion(entry.region)) {
    return { unsafeRegion: isRecord(entry) ? String(entry.region) : String(entry) };
  }

  const modePanel = modePanelForRegion(entry.region);
  if (modePanel && !panels.includes(modePanel)) return { unavailableRegion: entry.region };

  const normalizedEntry: ModeLayoutOpenEntry = { region: entry.region };
  if (typeof entry.title === "string") normalizedEntry.title = entry.title;
  if (typeof entry.pinned === "boolean") normalizedEntry.pinned = entry.pinned;
  if (typeof entry.resource === "string") normalizedEntry.resource = entry.resource;

  if (typeof entry.panel === "string") {
    const panelId = resolvePanelId(entry.panel, input);
    if (!panelId) return { missingPanel: entry.panel };
    normalizedEntry.panel = panelId;
  }

  if (!normalizedEntry.panel && !normalizedEntry.resource) return { invalid: true };
  return { entry: normalizedEntry };
};

const normalizeOpen = (
  openInput: unknown,
  input: NormalizeModeLayoutInput,
  panels: NonNullable<ModeLayoutContributionRecord["panels"]>,
) => {
  const open: ModeLayoutOpenEntry[] = [];
  const unsafeOpenRegions: string[] = [];
  const unavailableOpenRegions: string[] = [];
  const missingPanels: string[] = [];
  let invalidOpenEntry = openInput !== undefined && !Array.isArray(openInput);

  if (!Array.isArray(openInput)) {
    return { open, unsafeOpenRegions, unavailableOpenRegions, missingPanels, invalidOpenEntry };
  }

  for (const rawEntry of openInput) {
    const result = normalizeOpenEntry(rawEntry, input, panels);
    if (result.entry) open.push(result.entry);
    if (result.unsafeRegion) unsafeOpenRegions.push(result.unsafeRegion);
    if (result.unavailableRegion) unavailableOpenRegions.push(result.unavailableRegion);
    if (result.missingPanel) missingPanels.push(result.missingPanel);
    if (result.invalid) {
      invalidOpenEntry = true;
    }
  }

  return { open, unsafeOpenRegions, unavailableOpenRegions, missingPanels, invalidOpenEntry };
};

const invalidMetadata = (input: {
  invalidOpenEntry: boolean;
  missingPanels: string[];
  unavailableOpenRegions: string[];
  unsafeOpenRegions: string[];
}) => {
  const { invalidOpenEntry, missingPanels, unavailableOpenRegions, unsafeOpenRegions } = input;

  if (
    unavailableOpenRegions.length > 0 ||
    unsafeOpenRegions.length > 0 ||
    missingPanels.length > 0 ||
    invalidOpenEntry
  ) {
    return {
      ...(unsafeOpenRegions.length > 0 ? { unsafeOpenRegions } : {}),
      ...(unavailableOpenRegions.length > 0 ? { unavailableOpenRegions } : {}),
      ...(missingPanels[0] ? { missingPanel: missingPanels[0], missingPanels } : {}),
      ...(invalidOpenEntry ? { invalidOpenEntry } : {}),
    };
  }

  return undefined;
};

export const normalizeModeLayout = (input: NormalizeModeLayoutInput) => {
  if (input.layout === undefined) return { layout: undefined };
  if (!isRecord(input.layout)) {
    return { diagnostic: createInvalidLayoutDiagnostic(input, { invalidLayout: true }) };
  }

  const { panels, invalid: invalidPanels } = normalizeWorkbenchModePanels(input.layout.panels);
  if (invalidPanels) return { diagnostic: createInvalidLayoutDiagnostic(input, { invalidPanels: true }) };

  const openResult = normalizeOpen(input.layout.open, input, panels);
  const metadata = invalidMetadata(openResult);

  if (metadata) {
    return { diagnostic: createInvalidLayoutDiagnostic(input, metadata) };
  }

  return {
    layout: {
      panels,
      ...(input.layout.open !== undefined ? { open: openResult.open } : {}),
    } satisfies ModeLayoutContributionRecord,
  };
};
