import { eventRef } from "@pstdio/sdk/extensions";

export const diagnosticsChanged = eventRef({ extensionId: "pstdio.performance", id: "diagnostics.changed" });
export const diagnosticsAutomationChanged = eventRef({
  extensionId: "pstdio.performance",
  id: "automation-run-changed",
});
