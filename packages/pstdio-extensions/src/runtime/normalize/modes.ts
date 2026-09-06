import { extensionPanelRegions, type ModeContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";
import { normalizeContributionRef } from "./references";

const isRef = (value: unknown, kind: string) =>
  isRecord(value) &&
  value.kind === kind &&
  typeof value.id === "string" &&
  value.id.length > 0 &&
  (value.extensionId === undefined || typeof value.extensionId === "string");
const validChrome = (value: unknown) =>
  value === undefined ||
  (isRecord(value) &&
    Object.entries(value).every(
      ([region, view]) =>
        ["nav", "sidenav", "activity", "status"].includes(region) && (view === false || isRef(view, "view")),
    ));

export const registerModes = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const modes = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "mode",
    contributions: contributionArray<ModeContribution>(source.definition.modes),
  });
  for (const mode of modes) {
    const localId = mode.id;
    const hasValidRegions =
      Array.isArray(mode.regions) &&
      mode.regions.every(
        (region) =>
          typeof region === "string" &&
          extensionPanelRegions.includes(region as (typeof extensionPanelRegions)[number]),
      );
    const hasValidRegionSettings =
      mode.regionSettings === undefined ||
      (hasValidRegions &&
        isRecord(mode.regionSettings) &&
        Object.keys(mode.regionSettings).every(
          (region) => region === "sidenav" || (mode.regions as readonly string[]).includes(region),
        ));
    if (
      !isRecord(mode) ||
      !isLocalizableString(mode.label) ||
      !hasValidRegions ||
      !hasValidRegionSettings ||
      (mode.defaultTheme !== undefined && !isRef(mode.defaultTheme, "theme")) ||
      !validChrome(mode.chrome)
    ) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_mode",
          message: `Mode "${localId}" must declare a label and valid workbench regions`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: localId, fieldPath: `modes.${localId}.regions` },
        }),
      );
      continue;
    }
    runtime.modes.push({
      ...contributionRecordBase(ext, source, "mode", localId),
      contribution: {
        ...mode,
        ref: normalizeContributionRef(ext, mode.ref),
        ...(mode.defaultTheme ? { defaultTheme: normalizeContributionRef(ext, mode.defaultTheme) } : {}),
        ...(mode.chrome
          ? {
              chrome: Object.fromEntries(
                Object.entries(mode.chrome).map(([region, view]) => [
                  region,
                  view === false ? false : normalizeContributionRef(ext, view),
                ]),
              ),
            }
          : {}),
      } as ModeContribution,
    });
  }
};
