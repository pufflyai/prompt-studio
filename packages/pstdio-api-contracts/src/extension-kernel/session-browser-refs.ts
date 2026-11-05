import { commandRef } from "./refs";

export const sessionBrowserId = "pstdio.pstdio-session-browser";
const ref = <K extends "page" | "placement" | "view">(kind: K, id: string) => ({
  kind,
  id,
  extensionId: sessionBrowserId,
});
/** Implementation-free contract owned by the independently installed Sessions provider.
 * These targets are unavailable when that provider is disabled or missing.
 * Session and draft resource identities continue to belong to core (`pstdio`).
 */
export const sessionBrowser = {
  pages: {
    sessions: ref("page", "sessions"),
    session: ref("page", "session"),
    compose: ref("page", "compose"),
    draft: ref("page", "draft"),
  },
  panels: { conversation: ref("placement", "conversation") },
  views: { conversation: ref("view", "conversation"), list: ref("view", "list") },
  commands: {
    create: commandRef<
      { workspaceId?: string; harnessId?: string; deviceId?: string; side?: boolean; replace?: boolean },
      void
    >({ extensionId: sessionBrowserId, id: "new" }),
    open: commandRef<{ sessionId: string; side?: boolean; replace?: boolean }, void>({
      extensionId: sessionBrowserId,
      id: "open",
    }),
  },
};
