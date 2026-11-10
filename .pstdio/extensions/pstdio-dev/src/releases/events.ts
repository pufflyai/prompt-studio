import { eventRef } from "@pstdio/sdk/extensions";
export const healthChanged = eventRef({ extensionId: "pstdio.pstdio-dev", id: "release-health.changed" });

export const healthAutomationChanged = eventRef({ extensionId: "pstdio.pstdio-dev", id: "automation-run-changed" });
