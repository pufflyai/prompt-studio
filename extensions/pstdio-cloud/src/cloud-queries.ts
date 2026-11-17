import { type AccountStatus, accountEvents, viewDataEvents } from "@pstdio/sdk/extensions";
import type { CloudClient } from "./cloud-context";

/** Account/origin services share the runtime owner; project preparation remains a finite command. */
export const createCloudQueries = (client: CloudClient, projectId: string | undefined) => ({
  account: client.account.query({ service: "status" }),
  projectSync: projectId
    ? client.account.query({ service: "projectSyncStatus", projectId })
    : client.queries.query({
        id: "cloud.local-sync",
        scope: { projectId: undefined },
        read: () => ({ state: "local" as const, offlineReady: true }),
      }),
  projectState: () =>
    client.commands["project-state"].query(undefined, {
      events: [accountEvents.changed, accountEvents.projectSyncChanged, viewDataEvents.workspacesChanged],
    }),
  devices: (login: NonNullable<AccountStatus["login"]>) =>
    client.account.query({ service: "devices", accountId: login.accountId, managerOrigin: login.managerOrigin }),
});
