// Read a value through a command, read it again whenever one of the given events fires, and retry after a failure.
import type { EventRef } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import type { PlanClient } from "./use-plan";

// A failed read, for example while Planner restarts, is retried after this delay until it succeeds.
const retryDelayMs = 5000;

// Callers pass a module-level read and event list, so the subscription restarts only for a new client.
export function useLiveValue<T>(
  client: PlanClient,
  read: (client: PlanClient) => Promise<T>,
  events: readonly EventRef<{ reason?: string; ticketId?: string; artifactId?: string }>[],
) {
  const [value, setValue] = useState<T>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    let request = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      const serial = ++request;
      clearTimeout(retry);
      try {
        const next = await read(client);
        if (active && serial === request) {
          setValue(next);
          setError(undefined);
        }
      } catch (reason) {
        if (active && serial === request) {
          setError(String(reason));
          retry = setTimeout(() => void refresh(), retryDelayMs);
        }
      }
    };

    // Subscribe before the first read so a change during that read is not missed.
    const unsubscribe = events.map((event) => client.events.subscribe(event, () => void refresh()));
    void refresh();
    return () => {
      active = false;
      clearTimeout(retry);
      for (const stop of unsubscribe) {
        stop();
      }
    };
  }, [client, read, events]);

  return { value, setValue, error };
}
