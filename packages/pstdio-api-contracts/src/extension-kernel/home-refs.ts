import type { PageRef } from "./types/contribution-identity";

/** Explicit bundled Home references. Use workbenchPages.start for the host-selected landing. */
export const homePages = {
  home: { kind: "page", extensionId: "pstdio.pstdio-home", id: "home" } satisfies PageRef,
};
