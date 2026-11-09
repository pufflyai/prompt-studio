import { type AccountStatus, accountEvents } from "@pstdio/sdk/extensions";
import type { CloudClient } from "./cloud-context";

type CloudReader = Pick<CloudClient, "queries"> & {
  account: Pick<CloudClient["account"], "status" | "projectSyncStatus" | "devices">;
};
const accountOwner = (account: AccountStatus | undefined) =>
  account?.login ? JSON.stringify([account.login.managerOrigin, account.login.accountId]) : undefined;

const readAccount = async (client: CloudReader, projectId?: string) => {
  const [account, sync] = await Promise.all([
    client.account.status(),
    projectId
      ? client.account.projectSyncStatus(projectId)
      : Promise.resolve({ state: "local" as const, offlineReady: true }),
  ]);
  return {
    account,
    sync,
    signingIn: account.loginAttempt?.status === "pending",
    loginFailed: account.loginAttempt?.status === "failed",
  };
};

export const createCloudQueries = (client: CloudReader, projectId: string | undefined) => {
  const snapshot = client.queries.query({
    id: "cloud.snapshot",
    scope: { projectId },
    events: [accountEvents.changed, accountEvents.projectSyncChanged],
    read: () => readAccount(client, projectId),
  });
  return {
    snapshot,
    devices(login: NonNullable<AccountStatus["login"]>) {
      const expected = JSON.stringify([login.managerOrigin, login.accountId]);
      return client.queries.query({
        id: "cloud.devices",
        scope: { projectId: undefined, accountId: login.accountId, accountOrigin: login.managerOrigin },
        events: [accountEvents.changed],
        read: async () => {
          // Status and device refreshes share admission. Never attach another account's
          // response to the old account while a newer status is still being read.
          const current = await snapshot.read();
          if (accountOwner(current.account) !== expected) return [];
          const loaded = await client.account.devices();
          return accountOwner(snapshot.getSnapshot().data?.account) === expected ? loaded : [];
        },
      });
    },
  };
};
