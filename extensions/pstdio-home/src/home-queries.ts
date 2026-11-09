import {
  createWebviewClient,
  type GuestHost,
  getCommandValue,
  viewDataEvents,
  workbenchCommands,
} from "@pstdio/sdk/extensions";
import type { commands } from "./commands";
import { recentProjectResources } from "./recent-resources";

export const createHomeQueries = (host: GuestHost, projectId: string) => {
  const client = createWebviewClient<typeof commands>(host);
  const scope = { projectId };
  return {
    home: client.queries.query({
      id: "home.setup",
      scope,
      events: [viewDataEvents.projectsChanged, viewDataEvents.workspacesChanged],
      read: () => client.commands.read(),
    }),
    recent: client.queries.query({
      id: "home.recent",
      scope,
      events: [
        viewDataEvents.recentResourcesChanged,
        viewDataEvents.sessionsChanged,
        viewDataEvents.workspacesChanged,
        viewDataEvents.resourcesChanged,
      ],
      read: async () => {
        const response = await host.call("commands.execute", {
          commandId: workbenchCommands.recentResources.id,
          params: {},
        });
        return recentProjectResources(
          getCommandValue(response.outcome) as NonNullable<typeof workbenchCommands.recentResources.result>,
        );
      },
    }),
  };
};
