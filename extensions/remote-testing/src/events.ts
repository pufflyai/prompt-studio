import { eventRef } from "@pstdio/sdk/extensions";

// Views refresh when runs or environments change.
export const changed = eventRef({ extensionId: "pocketcoder.remote-testing", id: "changed" });

export const notifyRunChange = (deps: { changed?: () => unknown }) =>
  Promise.resolve()
    .then(() => deps.changed?.())
    .catch(() => {});
