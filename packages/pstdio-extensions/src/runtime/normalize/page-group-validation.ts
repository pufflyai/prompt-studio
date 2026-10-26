import type { RuntimePageRecord } from "../../types/runtime";
import type { Accumulator } from "./accumulator";
import { addPageDiagnostic, normalizedRefId } from "./page-validation";

export const validatePageGroup = (runtime: Accumulator, record: RuntimePageRecord) => {
  const page = record.contribution;
  const main = page.main;
  if (main.kind !== "group") return;
  const child = runtime.pages.find((candidate) => candidate.id === normalizedRefId(main.default, record.extensionId));
  const parent = child?.contribution.parent;
  const validChild =
    child &&
    parent &&
    normalizedRefId(parent, child.extensionId) === record.id &&
    normalizedRefId(child.contribution.mode, child.extensionId) === normalizedRefId(page.mode, record.extensionId) &&
    !child.contribution.resource;
  if (!validChild)
    addPageDiagnostic(runtime, {
      record,
      code: "extension_page_group_invalid",
      fieldPath: `pages.${record.localId}.main.default`,
      failedReference: main.default.id,
      message: "A group requires an available default child in the same mode that opens without a resource",
    });
  if (page.resource || page.document || page.slots.length || page.panelView)
    addPageDiagnostic(runtime, {
      record,
      code: "extension_page_group_invalid",
      fieldPath: `pages.${record.localId}.main`,
      message: "A group cannot declare content, resources, or panels",
    });
};
