import type { RuntimePageRecord } from "../../types/runtime";
import type { Accumulator } from "./accumulator";
import { addPageDiagnostic, normalizedRefId } from "./page-validation";

const validLanding = (record: RuntimePageRecord, placement: Accumulator["placements"][number]) => {
  const item = placement.contribution.item;
  if (item.kind === "view") return true;
  const page = record.contribution;
  const kinds = new Set(item.binding.kinds.map((kind) => normalizedRefId(kind, placement.extensionId)));
  return (
    item.binding.cardinality === "many" &&
    placement.contribution.region === "main" &&
    Boolean(page.resource?.kinds.every((kind) => kinds.has(normalizedRefId(kind, record.extensionId))))
  );
};

export const validatePagePanels = (runtime: Accumulator, record: RuntimePageRecord) => {
  const page = record.contribution;
  const landing = page.main.kind === "panels" ? page.main.landing : undefined;
  const references = [
    { ref: page.panelView, field: "panelView", isLanding: false },
    { ref: typeof landing === "string" ? undefined : landing, field: "main.landing", isLanding: true },
  ];
  for (const { ref, field, isLanding } of references) {
    if (!ref || ref.extensionId !== record.extensionId) continue;
    const placement = runtime.placements.find((placement) => placement.id === normalizedRefId(ref, record.extensionId));
    const valid =
      placement &&
      normalizedRefId(placement.contribution.mode, record.extensionId) ===
        normalizedRefId(page.mode, record.extensionId) &&
      (!isLanding || validLanding(record, placement));
    if (!valid)
      addPageDiagnostic(runtime, {
        record,
        code: "extension_page_panel_invalid",
        fieldPath: `pages.${record.localId}.${field}`,
        failedReference: ref.id,
        message: isLanding
          ? "The landing must name a static placement or compatible many-resource Main viewer in the page's mode"
          : "The panel view must name a placement in the page's mode",
      });
  }
};
