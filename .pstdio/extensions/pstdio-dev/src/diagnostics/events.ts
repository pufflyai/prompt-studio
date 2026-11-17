import { eventRef } from "@pstdio/sdk/extensions";

// Shared by the backend and webviews, so it stays free of Node imports.
export const storageReportChanged = eventRef({ extensionId: "pstdio.dev", id: "diagnostics.storage-changed" });
export const storageAutomationChanged = eventRef({ extensionId: "pstdio.dev", id: "automation-run-changed" });
