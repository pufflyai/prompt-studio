import { eventRef } from "@pstdio/sdk/extensions";

export const piecesChanged = eventRef<{ id: string }>({ extensionId: "pstdio.shape-art", id: "pieces.changed" });
