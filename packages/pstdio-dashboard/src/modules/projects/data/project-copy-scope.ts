import type { AccountStatus, ProjectCopyAccount, ProjectCopyDevice } from "@pstdio/sdk/client";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import type { RuntimeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";

export const sameProjectCopyDevice = (current?: ProjectCopyDevice | null, expected?: ProjectCopyDevice) =>
  Boolean(
    current &&
      expected &&
      current.accountId === expected.accountId &&
      current.managerOrigin === expected.managerOrigin &&
      current.deviceId === expected.deviceId,
  );

export const cloudCopySourceCommand = (teamAccountId?: string) => ({
  id: dashboardCommandIds.openProjects,
  ...(teamAccountId && { args: { teamAccountId } }),
});

export const projectTeamAccountId = (status: AccountStatus | undefined, id: string) =>
  status?.teamProjectOwners?.[id] ?? status?.teamProjects?.[id];

export const requireProjectCopyScope = (
  owner: RuntimeCollections,
  id: string,
  expected: ProjectCopyAccount,
  expectedDevice: ProjectCopyDevice | undefined,
  message: string,
) => {
  const statusQuery = getDashboardAccountStatusQuery(owner);
  const queries = getDashboardScopedQueries(owner);
  const current = () => {
    const status = statusQuery.getSnapshot().data;
    const login = status?.login;
    const { accountId, accountOrigin } = queries.getScope();
    const teamId = projectTeamAccountId(status, id);
    if (
      !login ||
      status?.signInRequired ||
      !sameProjectCopyDevice(login, expectedDevice) ||
      login.accountId !== accountId ||
      login.managerOrigin !== accountOrigin ||
      expected.managerOrigin !== login.managerOrigin ||
      expected.accountId !== (teamId ?? login.accountId) ||
      (teamId && !status?.teamAccounts?.some(({ accountId }) => accountId === teamId))
    )
      throw new Error(message);
    return login;
  };

  const login = current();
  return {
    login,
    accountId: expected.accountId === login.accountId ? undefined : expected.accountId,
    assertCurrent() {
      current();
    },
  };
};
