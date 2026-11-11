import { eventRef } from "@pstdio/sdk/extensions";

export const pullRequestsChanged = eventRef<{ id: string }>({
  extensionId: "pstdio.github",
  id: "pull-requests.changed",
});
