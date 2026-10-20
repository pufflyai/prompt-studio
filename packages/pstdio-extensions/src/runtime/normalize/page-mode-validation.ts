import { type ModeRef, workbenchModeDefinitions, workbenchPageDefinitions } from "@pstdio/sdk/extensions";
import type { Accumulator } from "./accumulator";
import { addPageDiagnostic, normalizedRefId } from "./page-validation";

const validateModeReferences = (
  runtime: Accumulator,
  record: Accumulator["pages"][number],
  modes: readonly ModeRef[],
) => {
  for (const [index, ref] of modes.entries()) {
    const hostMode =
      ref.extensionId === "pstdio" && Object.values(workbenchModeDefinitions).some((mode) => mode.ref.id === ref.id);
    if (!hostMode && !runtime.modes.some((mode) => mode.id === normalizedRefId(ref, record.extensionId)))
      addPageDiagnostic(runtime, {
        record,
        code: "extension_page_mode_invalid",
        fieldPath: `pages.${record.localId}.modes.${index}`,
        message: "The page names an unknown mode",
        failedReference: ref.id,
      });
  }
};

export const validatePageModeLists = (runtime: Accumulator) => {
  for (const record of runtime.pages) {
    const { mode, modes } = record.contribution;
    if (!modes) continue;
    validateModeReferences(runtime, record, modes);
    const ids = modes.map((ref) => normalizedRefId(ref, record.extensionId));
    if (new Set(ids).size !== ids.length || !ids.includes(normalizedRefId(mode, record.extensionId))) {
      addPageDiagnostic(runtime, {
        record,
        code: "extension_page_modes_invalid",
        fieldPath: `pages.${record.localId}.modes`,
        message: "Modes must be unique and include the default mode",
      });
    }
  }
  for (const record of runtime.modes) {
    const base = record.contribution.basePage;
    if (!base) continue;
    const page = runtime.pages.find((page) => page.id === normalizedRefId(base, record.extensionId));
    const host =
      base.extensionId === "pstdio"
        ? Object.values(workbenchPageDefinitions).find((page) => page.ref.id === base.id)
        : undefined;
    let modes: readonly ModeRef[] = host ? [host.mode] : [];
    if (page) modes = [...(page.contribution.modes ?? [page.contribution.mode])];
    const available = modes.some((ref) => normalizedRefId(ref, page?.extensionId ?? "pstdio") === record.id);
    if (!available)
      addPageDiagnostic(runtime, {
        record,
        code: "extension_mode_base_page_invalid",
        fieldPath: `modes.${record.localId}.basePage`,
        message: "The base page must exist and allow this mode",
        failedReference: base.id,
      });
  }
};
