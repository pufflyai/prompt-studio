import { type createWebviewClient, viewDataEvents, workbenchCommands } from "@pstdio/sdk/extensions";
import type { commands } from "./commands";

/** Finite reads belong to the project query owner, including after a Home frame is recreated. */
export const homeQueries = (client: ReturnType<typeof createWebviewClient<typeof commands>>) => ({
  home: client.commands.read.query(undefined, {
    events: [viewDataEvents.sessionsChanged, viewDataEvents.workspacesChanged],
  }),
  recent: client.queries.command(
    workbenchCommands.recentResources,
    {},
    {
      events: [viewDataEvents.recentResourcesChanged],
    },
  ),
});
