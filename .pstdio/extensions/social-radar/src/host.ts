import type { GuestHost, JsonObject } from "@pstdio/sdk/extensions";
import { unwrapCommandOutcome } from "@pstdio/sdk/extensions";
import { createContext, useContext } from "react";
export const HostContext = createContext<GuestHost | null>(null);
export const useRadarCommand = () => {
  const host = useContext(HostContext);
  if (!host) throw new Error("Social radar needs the extension host.");
  return async <T>(command: string, params: JsonObject = {}) =>
    unwrapCommandOutcome(
      await host.call("commands.execute", {
        commandId: `pstdio.social-radar.command.${command}`,
        params,
      }),
    ) as T;
};
