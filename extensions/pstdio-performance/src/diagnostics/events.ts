import { eventRef } from "@pstdio/sdk/extensions";

export const diagnosticsChanged = eventRef({ extensionId: "pstdio.performance", id: "diagnostics.changed" });
