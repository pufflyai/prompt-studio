// Read a value through a command, read it again whenever one of the given events fires, and retry after a failure.
import type { EventRef } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import { createLiveRead } from "./live-read";
import type { PlanClient } from "./use-plan";

// A failed read, for example while Planner restarts, is retried after this delay until it succeeds.
const retryDelayMs = 5000;

// Callers pass a module-level read and event list, so the subscription restarts only for a new client.
export function useLiveValue<T, Client extends Pick<PlanClient, "events">>(
  client: Client,
  read: (client: Client, resourceId?: string) => Promise<T>,
  events: readonly EventRef[],
  resourceId?: string,
) {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | undefined;
    const reader = createLiveRead(() => read(client, resourceId), {
      onValue: (next) => {
        setValue(next);
      },
      onError: () => {
        retry = setTimeout(() => void refresh(), retryDelayMs);
      },
    });
    const refresh = async () => {
      clearTimeout(retry);
      await reader.refresh();
    };

    // Subscribe before the first read so a change during that read is not missed.
    const unsubscribe = events.map((event) => client.events.subscribe(event, () => void refresh()));
    void refresh();
    return () => {
      reader.dispose();
      clearTimeout(retry);
      for (const stop of unsubscribe) {
        stop();
      }
    };
  }, [client, read, events, resourceId]);

  return { value, setValue };
}
