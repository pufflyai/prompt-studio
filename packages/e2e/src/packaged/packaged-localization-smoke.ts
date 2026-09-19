import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectAutomaticTranslationMetadata = (metadata: WorkbenchExtensionMetadata) => {
  const view = metadata.views.find(
    (item) => item.extensionId === "pstdio.extension-lab" && item.localId === "zipline-board",
  );
  expect(view?.title).toMatchObject({ $l10n: "contributions/views/zipline-board/title", default: expect.any(String) });
  const planner = metadata.views.find(
    (item) => item.extensionId === "pstdio.pstdio-planner" && item.localId === "tickets",
  );
  expect(planner?.body).toMatchObject({
    kind: "kanban",
    createRow: {
      submitLabel: { $l10n: "contributions/views/tickets/body/createRow/submitLabel", default: expect.any(String) },
    },
  });
};
