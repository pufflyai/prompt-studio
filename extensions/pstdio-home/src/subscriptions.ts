import { viewDataEvents, type WebviewEventsClient } from "@pstdio/sdk/extensions";

export const subscribeHome = (events: WebviewEventsClient, refresh: () => void) => {
  const disposers = [viewDataEvents.sessionsChanged, viewDataEvents.workspacesChanged].map((event) =>
    events.subscribe(event, refresh),
  );
  return () => {
    for (const dispose of disposers) dispose();
  };
};
