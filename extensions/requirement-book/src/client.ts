import { createWebviewClient } from "@pstdio/sdk/extensions";
import type { commands } from "./commands";
export const makeClient = (host: Parameters<typeof createWebviewClient>[0]) => {
  let sequence = 0;
  return {
    ...createWebviewClient<typeof commands>(host),
    saveDraft: async (sessionId: string, text: string, expectedRevision: string) => {
      const response = await host.call("editing.session", {
        operation: "execute",
        sessionId,
        sequence: ++sequence,
        params: { draft: text, expectedRevision },
        changes: [{ path: ["draft"], value: text }],
        channel: "document",
      });
      if (!response || !("savedDraftRevision" in response) || typeof response.savedDraftRevision !== "string")
        throw new Error("The draft changed in another view.");
      return response.savedDraftRevision;
    },
    retainDraft: (sessionId: string, draft: { text: string; baseRevision: string } | null) =>
      host.call("editing.session", {
        operation: "preview",
        sessionId,
        sequence: ++sequence,
        retainFormDraft: true,
        changes: draft
          ? [
              { path: ["draft"], value: draft.text },
              { path: ["draftBase"], value: draft.baseRevision },
            ]
          : [],
      }),
  };
};
export type BookClient = ReturnType<typeof makeClient>;
