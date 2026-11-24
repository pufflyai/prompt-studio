import type { AccountStatus, ProjectCopyAccount, ProjectCopyDevice } from "@pstdio/sdk/client";
import { operationSubject, type WorkbenchOperations } from "@pstdio/workbench";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections, type RuntimeCollections } from "@/lib/sync/collections";
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

export const projectCopyScopeKey = (
  owner: RuntimeCollections,
  id: string,
  device?: ProjectCopyDevice,
  account?: ProjectCopyAccount,
) =>
  JSON.stringify([owner.id, id, device?.managerOrigin, device?.accountId, device?.deviceId, account?.accountId]);

export const cloudCopySyncKey = (scope: string) => ["cloud-project-opening", scope] as const;

export const cloudProjectCopySubject = (id: string, account: ProjectCopyAccount) =>
  operationSubject("cloud-project-copy", account.managerOrigin, account.accountId, id);

export const deviceProjectCopySubject = (id: string, account: ProjectCopyAccount, device: ProjectCopyDevice) =>
  operationSubject("cloud-project-device-copy", account.managerOrigin, account.accountId, id, device.accountId, device.deviceId);

export const cloudCopyBusy = (
  operations: WorkbenchOperations,
  id: string,
  account?: ProjectCopyAccount,
  device?: ProjectCopyDevice,
) => {
  if (!account) return false;
  const subject = cloudProjectCopySubject(id, account);
  const local = device && deviceProjectCopySubject(id, account, device);
  return operations.getSnapshot().pending.some(
    (entry) => entry.subjects.includes(subject) || (local ? entry.subjects.includes(local) : entry.intent === subject),
  );
};

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
    const snapshot = statusQuery.getSnapshot();
    const status = snapshot.data;
    const login = status?.login;
    const { accountId, accountOrigin } = queries.getScope();
    const teamId = projectTeamAccountId(status, id);
    if (
      owner.isDisposed() ||
      getRuntimeCollections() !== owner ||
      snapshot.error ||
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
    key: projectCopyScopeKey(owner, id, login, expected),
    accountId: expected.accountId === login.accountId ? undefined : expected.accountId,
    assertCurrent() {
      current();
    },
    async waitForCurrent(signal: AbortSignal) {
      if (statusQuery.getSnapshot().fetching) await statusQuery.read(signal);
      signal.throwIfAborted();
      current();
    },
  };
};
