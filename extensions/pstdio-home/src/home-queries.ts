import { viewDataEvents, type WebviewClient, workbenchCommands } from "@pstdio/sdk/extensions";
import type { commands } from "./commands";

export const createHomeQueries = (client: WebviewClient<typeof commands>) => {
  return {
    home: client.commands.read.query(undefined, {
      events: [viewDataEvents.projectsChanged, viewDataEvents.workspacesChanged],
    }),
    recent: client.queries.command(workbenchCommands.recentResources, undefined, {
      events: [
        viewDataEvents.recentResourcesChanged,
        viewDataEvents.sessionsChanged,
        viewDataEvents.workspacesChanged,
        viewDataEvents.resourcesChanged,
      ],
    }),
  };
};
