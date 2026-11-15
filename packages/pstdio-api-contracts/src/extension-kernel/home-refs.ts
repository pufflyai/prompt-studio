import type { PageRef } from "./types/contribution-identity";

/** Public landing owned by the bundled Home provider. */
export const homePages = {
  home: { kind: "page", extensionId: "pstdio.home", id: "home" } satisfies PageRef,
};
