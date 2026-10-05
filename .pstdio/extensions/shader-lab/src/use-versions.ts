import { createWebviewClient, type GuestHost } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import type { commands } from "./commands";
import type { ShaderConfig } from "./configs";
import { shadersChanged } from "./events";
import { resolveOpenVersion } from "./navigation";

// Reads the open version and, when one is chosen, the version it is compared with.
// An empty list means the lab has no shaders.
export const useVersions = (host: GuestHost, requested?: string) => {
  const [versions, setVersions] = useState<ShaderConfig[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const client = createWebviewClient<typeof commands>(host);
    let active = true;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const open = resolveOpenVersion(await client.commands["shaders.list"]({}), requested);
        const read = async () => {
          if (!open) return [];
          const { shader, version } = open;
          const [config, compare] = await Promise.all([
            client.commands["version.read"]({ shader, version }),
            client.commands["compare.read"]({ shader }),
          ]);
          const compared =
            compare.version && compare.version !== version
              ? await client.commands["version.read"]({ shader, version: compare.version }).catch(() => null)
              : null;
          return compared ? [config, compared] : [config];
        };
        const next = await read();
        // A newer refresh or a different version may have replaced this request.
        if (!active || current !== request) return;
        setVersions(next);
        setError(undefined);
      } catch (reason) {
        if (active && current === request) setError(String(reason));
      }
    };
    const unsubscribe = client.events.subscribe(shadersChanged, () => void refresh());
    void refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [host, requested]);
  return { versions, error };
};
