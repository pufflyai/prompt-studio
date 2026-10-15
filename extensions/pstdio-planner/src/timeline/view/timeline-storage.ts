import type { GuestHost } from "@pstdio/sdk/extensions";
import type { HostStorage } from "@pstdio/ui";

const preference = { name: "timelineViewState", scope: { scope: "project" as const } };

// Sandboxed views cannot use browser storage. Load before mounting the shared collection controls.
export const createTimelineStorage = async (host: Pick<GuestHost, "call">, onError: (reason: unknown) => void) => {
  const saved = await host.call("preferences.get", preference);
  const values = { ...(saved as Record<string, string> | undefined) };
  let pending = Promise.resolve();
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem(key: string, value: string) {
      values[key] = value;
      const snapshot = { ...values };
      // Keep rapid filter and selection changes in order while the controls update immediately.
      pending = pending
        .then(async () => {
          await host.call("preferences.set", { ...preference, value: snapshot });
        })
        .catch(onError);
      return pending;
    },
  } satisfies HostStorage;
};
