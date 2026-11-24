import { contributionRefId } from "@pstdio/sdk/extensions";
import type { Accumulator } from "./accumulator";
import { addPageDiagnostic } from "./page-validation";

export const validateViewHeaders = (runtime: Accumulator) => {
  const views = new Map(runtime.views.map((view) => [view.id, view]));
  for (const record of runtime.views) {
    const header = record.contribution.header;
    if (!header) continue;
    const targetId = contributionRefId(header.view, record.extensionId);
    const fieldPath = `views.${record.localId}.header.view`;
    if (!views.has(targetId)) {
      addPageDiagnostic(runtime, {
        record,
        fieldPath,
        code: "extension_view_missing",
        failedReference: targetId,
        message: `View "${record.localId}" header names unknown view "${targetId}"`,
      });
      continue;
    }
    const visited = new Set([record.id]);
    let next: string | undefined = targetId;
    while (next) {
      if (visited.has(next)) {
        addPageDiagnostic(runtime, {
          record,
          fieldPath,
          code: "extension_view_header_cycle",
          failedReference: next,
          message: `View "${record.localId}" header references form a cycle`,
        });
        break;
      }
      visited.add(next);
      const target = views.get(next);
      const child = target?.contribution.header;
      next = child ? contributionRefId(child.view, target!.extensionId) : undefined;
    }
  }
};
