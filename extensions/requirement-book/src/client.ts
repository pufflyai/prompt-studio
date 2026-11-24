import { createWebviewClient } from "@pstdio/sdk/extensions";
import type { commands } from "./commands";
export const makeClient = (host: Parameters<typeof createWebviewClient>[0]) => {
  let sequence = 0;
  return {
    ...createWebviewClient<typeof commands>(host),
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
