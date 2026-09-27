import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import { type ReviewSettings, settingsChanged } from "./catalog";
import type { commands } from "./commands";

export const useReviewSettings = (host: GuestHost, id: string) => {
  const [settings, setSettings] = useState<ReviewSettings>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const client = createWebviewClient<typeof commands>(host);
    let active = true;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const next = await client.commands["review.read"]({ id });
        // A newer refresh or a different resource may have replaced this request.
        if (!active || current !== request) return;
        setSettings(next);
        setError(undefined);
      } catch (reason) {
        if (active && current === request) setError(String(reason));
      }
    };
    const unsubscribe = client.events.subscribe(settingsChanged, () => void refresh());
    void refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [host, id]);
  return { settings, error };
};
