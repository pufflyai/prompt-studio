import { eventRef } from "@pstdio/sdk/extensions";
export const layoutChanged = eventRef<{ canvas: string }>({ extensionId: "pstdio.canvas", id: "layout-changed" });
