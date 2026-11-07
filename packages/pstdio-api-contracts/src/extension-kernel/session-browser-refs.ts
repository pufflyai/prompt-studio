import { commandRef } from "./refs";
import type { PlacementRef } from "./types/contribution-identity";
import type { ResourceRef, ResourceResolution } from "./types/resources";

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
    sessions: ref("page", "browse"),
    session: ref("page", "conversation"),
    compose: ref("page", "compose"),
    draft: ref("page", "draft"),
  },
  panels: { conversation: ref("placement", "conversation") },
  views: { conversation: ref("view", "conversation"), list: ref("view", "list") },
  commands: {
    resolve: commandRef<{ resources: ResourceRef[] }, ResourceResolution[]>({
      extensionId: sessionBrowserId,
      id: "resolve",
    }),
    create: commandRef<
      {
        workspaceId?: string;
        harnessId?: string;
        deviceId?: string;
        side?: boolean;
        /** With side, open the new draft in this declared placement; defaults to the Sessions Project placement. */
        panel?: PlacementRef;
        replace?: boolean;
      },
      void
    >({ extensionId: sessionBrowserId, id: "new" }),
    open: commandRef<
      {
        sessionId: string;
        side?: boolean;
        /** With side, open in this declared placement; defaults to the Sessions Project placement. */
        panel?: PlacementRef;
        replace?: boolean;
      },
      void
    >({
      extensionId: sessionBrowserId,
      id: "open",
    }),
  },
};
