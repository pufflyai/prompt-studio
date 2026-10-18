import type { GuestHost } from "@pstdio/sdk/extensions";

export const reportTimelineError = (host: Pick<GuestHost, "call">, error: unknown) =>
  host
    .call("notification.show", {
      level: "error",
      title: "Project Timeline",
      message: error instanceof Error ? error.message : String(error),
    })
    .catch(() => {
      // The host owns bridge and connection failures, including unavailable notifications.
    });
