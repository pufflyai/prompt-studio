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
) => JSON.stringify([owner.id, id, device?.managerOrigin, device?.accountId, device?.deviceId, account?.accountId]);

export const cloudCopySyncKey = (scope: string) => ["cloud-project-opening", scope] as const;

export const cloudProjectCopySubject = (id: string, account: ProjectCopyAccount) =>
  operationSubject("cloud-project-copy", account.managerOrigin, account.accountId, id);

export const deviceProjectCopySubject = (id: string, account: ProjectCopyAccount, device: ProjectCopyDevice) =>
  `${cloudProjectCopySubject(id, account)}:${operationSubject("device", device.accountId, device.deviceId)}`;

export const cloudCopyBusy = (
  operations: WorkbenchOperations,
  id: string,
  account?: ProjectCopyAccount,
  device?: ProjectCopyDevice,
) => {
  if (!account) return false;
  const accountSubject = cloudProjectCopySubject(id, account);
  const deviceSubject = device && deviceProjectCopySubject(id, account, device);
  const devicePrefix = `${accountSubject}:`;
  return operations.getSnapshot().pending.some((entry) => {
    if (entry.subjects.includes(accountSubject)) return true;
    if (deviceSubject) return entry.subjects.includes(deviceSubject);
    // Discarding a draft leaves the device claim in place.
    return entry.subjects.some((subject) => subject.startsWith(devicePrefix));
  });
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
  const matchingLogin = (status?: AccountStatus) => {
    const login = status?.login;
    const teamId = projectTeamAccountId(status, id);
    if (
      !login ||
      status.signInRequired ||
      !sameProjectCopyDevice(login, expectedDevice) ||
      expected.managerOrigin !== login.managerOrigin ||
      expected.accountId !== (teamId ?? login.accountId) ||
      (teamId && !status.teamAccounts?.some(({ accountId }) => accountId === teamId))
    )
      return;
    return login;
  };
  const retired = () => {
    if (owner.isDisposed() || getRuntimeCollections() !== owner) return true;
    const { data, error, fetching } = statusQuery.getSnapshot();
    return Boolean(data && !error && !fetching && !statusQuery.inspect().stale && !matchingLogin(data));
  };
  const current = () => {
    const { data, error } = statusQuery.getSnapshot();
    const login = matchingLogin(data);
    const { accountId, accountOrigin } = queries.getScope();
    if (
      owner.isDisposed() ||
      getRuntimeCollections() !== owner ||
      error ||
      !login ||
      login.accountId !== accountId ||
      login.managerOrigin !== accountOrigin
    )
      throw new Error(message);
    return login;
  };
  const confirmed = (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (retired()) return false;
    const { data, error, fetching } = statusQuery.getSnapshot();
    if (!data || error || fetching || statusQuery.inspect().stale)
      throw new Error("Confirm the current Cloud device before reconciling this copy.");
    current();
    return true;
  };
  const login = current();
  return {
    login,
    key: projectCopyScopeKey(owner, id, login, expected),
    accountId: expected.accountId === login.accountId ? undefined : expected.accountId,
    retired,
    confirmed,
    async confirm(signal: AbortSignal) {
      if (retired()) return false;
      const { data, error, fetching } = statusQuery.getSnapshot();
      if (fetching) await statusQuery.read(signal);
      else if (!data || error || statusQuery.inspect().stale) await statusQuery.refresh(signal);
      return confirmed(signal);
    },
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
