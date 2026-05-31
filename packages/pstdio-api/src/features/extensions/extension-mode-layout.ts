import type { ExtensionDiagnostic, ModeLayoutContributionRecord } from "pstdio-api-contracts";
import { isRecord } from "./extension-diagnostics";

export const reservedDashboardModeIds = new Set(["project-selection", "project", "workspace", "settings"]);

type ModeLayoutTarget = NonNullable<ModeLayoutContributionRecord["open"]>[number]["target"];

const workbenchModeLayoutTargets = [
  "workbench.left",
  "workbench.main.left",
  "workbench.main",
  "workbench.main.right",
  "workbench.secondary",
] as const;

const safeModeLayoutTargets = new Set<string>(workbenchModeLayoutTargets);

export const isSafeModeLayoutTarget = (target: unknown): target is ModeLayoutTarget =>
  typeof target === "string" && safeModeLayoutTargets.has(target);

export const resolveModeId = (input: { extensionName: string; localId: string; id?: unknown }) =>
  typeof input.id === "string" && input.id.length > 0 ? input.id : `${input.extensionName}.${input.localId}`;

interface NormalizeModeLayoutInput {
  extensionId: string;
  extensionName: string;
  modeId: string;
  layout: unknown;
  sourcePath?: string;
  viewIdsByLocalId: Map<string, string>;
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

const normalizeReset = (reset: unknown) => {
  if (reset === undefined || typeof reset === "boolean") return { reset, unsafeTargets: [] as string[] };
  if (!Array.isArray(reset)) return { reset: undefined, unsafeTargets: [String(reset)] };

  const unsafeTargets = reset.filter((target): target is string => !isSafeModeLayoutTarget(target)).map(String);
  if (unsafeTargets.length > 0) return { reset: undefined, unsafeTargets };
  return { reset: reset as ModeLayoutContributionRecord["reset"], unsafeTargets };
};

const resolveViewId = (view: string, input: NormalizeModeLayoutInput) => {
  const localViewId = input.viewIdsByLocalId.get(view);
  if (localViewId) return localViewId;

  const extensionPrefix = `${input.extensionName}.`;
  if (view.startsWith(extensionPrefix) && [...input.viewIdsByLocalId.values()].includes(view)) return view;

  return undefined;
};

type ModeLayoutOpenEntry = NonNullable<ModeLayoutContributionRecord["open"]>[number];

const normalizeOpenEntry = (entry: unknown, input: NormalizeModeLayoutInput) => {
  if (!isRecord(entry) || !isSafeModeLayoutTarget(entry.target)) {
    return { unsafeTarget: isRecord(entry) ? String(entry.target) : String(entry) };
  }

  const normalizedEntry: ModeLayoutOpenEntry = { target: entry.target };
  if (typeof entry.title === "string") normalizedEntry.title = entry.title;
  if (typeof entry.pinned === "boolean") normalizedEntry.pinned = entry.pinned;
  if (typeof entry.widget === "string") normalizedEntry.widget = entry.widget;
  if (typeof entry.resource === "string") normalizedEntry.resource = entry.resource;

  if (typeof entry.view === "string") {
    const viewId = resolveViewId(entry.view, input);
    if (!viewId) return { missingView: entry.view };
    normalizedEntry.view = viewId;
  }

  if (!normalizedEntry.view && !normalizedEntry.resource) return { invalid: true };
  return { entry: normalizedEntry };
};

const normalizeOpen = (openInput: unknown, input: NormalizeModeLayoutInput) => {
  const open: ModeLayoutOpenEntry[] = [];
  const unsafeOpenTargets: string[] = [];
  const missingViews: string[] = [];
  let invalidOpenEntry = openInput !== undefined && !Array.isArray(openInput);

  if (!Array.isArray(openInput)) return { open, unsafeOpenTargets, missingViews, invalidOpenEntry };

  for (const rawEntry of openInput) {
    const result = normalizeOpenEntry(rawEntry, input);
    if (result.entry) open.push(result.entry);
    if (result.unsafeTarget) unsafeOpenTargets.push(result.unsafeTarget);
    if (result.missingView) missingViews.push(result.missingView);
    if (result.invalid) {
      invalidOpenEntry = true;
    }
  }

  return { open, unsafeOpenTargets, missingViews, invalidOpenEntry };
};

const invalidMetadata = (input: {
  invalidOpenEntry: boolean;
  missingViews: string[];
  unsafeOpenTargets: string[];
  unsafeResetTargets: string[];
}) => {
  const { invalidOpenEntry, missingViews, unsafeOpenTargets, unsafeResetTargets } = input;

  if (unsafeResetTargets.length > 0 || unsafeOpenTargets.length > 0 || missingViews.length > 0 || invalidOpenEntry) {
    return {
      ...(unsafeResetTargets.length > 0 ? { unsafeResetTargets } : {}),
      ...(unsafeOpenTargets.length > 0 ? { unsafeOpenTargets } : {}),
      ...(missingViews[0] ? { missingView: missingViews[0], missingViews } : {}),
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

  const { reset, unsafeTargets: unsafeResetTargets } = normalizeReset(input.layout.reset);
  const openResult = normalizeOpen(input.layout.open, input);
  const metadata = invalidMetadata({ ...openResult, unsafeResetTargets });

  if (metadata) {
    return { diagnostic: createInvalidLayoutDiagnostic(input, metadata) };
  }

  return {
    layout: {
      ...(reset !== undefined ? { reset } : {}),
      ...(input.layout.open !== undefined ? { open: openResult.open } : {}),
    } satisfies ModeLayoutContributionRecord,
  };
};
