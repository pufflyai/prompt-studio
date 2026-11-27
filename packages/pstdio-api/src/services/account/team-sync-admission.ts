import type { RelayWorkbench } from "../relay/runtime";
import type { createNativeCloudReturn } from "./native-cloud-return";
import type { DeviceLogin } from "./native-store";
import type { createProjectCopyStore, TeamAdmission } from "./project-copy-store";

const scope = (accountId: string, projectId: string) => JSON.stringify([accountId, projectId]);

const changedAdmissions = (local: RelayWorkbench[], previous: ReadonlyMap<string, string>) => {
  const withheld = new Set<string>();
  const changed: TeamAdmission[] = [];
  for (const connection of local) {
    const { accountId, userId, workbenchId: projectId, grantId, environmentId: deviceId, managerOrigin } = connection;
    if (!userId) continue;
    const before = previous.get(scope(accountId, projectId));
    if (!grantId && before) withheld.add(projectId);
    if (!grantId || grantId === before) continue;
    changed.push({ accountId, userId, projectId, grantId, managerOrigin, deviceId });
  }
  return { changed, withheld };
};

export const createTeamSyncAdmission =
  (
    copies: Pick<ReturnType<typeof createProjectCopyStore>, "teamAdmissions" | "rememberTeamAdmissions">,
    returns: Pick<ReturnType<typeof createNativeCloudReturn>, "prepareGrantReturn">,
  ) =>
  async (
    login: DeviceLogin | null,
    local: RelayWorkbench[],
    projects: string[] | undefined,
    update: (connections: RelayWorkbench[]) => Promise<void>,
  ) => {
    if (!login || !local.some(({ userId }) => userId)) return update(local);
    const previous = new Map(
      (await copies.teamAdmissions(login)).map((row) => [scope(row.accountId, row.projectId), row.grantId]),
    );
    const { changed, withheld } = changedAdmissions(local, previous);
    const suspended = new Set([...withheld, ...changed.map(({ projectId }) => projectId)]);
    await update(local.filter(({ workbenchId }) => !suspended.has(workbenchId)));
    if (!changed.length || !projects) return;

    // The prior connection has drained. Fold unpublished changes and mark the copy as returning
    // before the newly granted connection can start its normal download/rebase path.
    const returning = new Set(changed.map(({ projectId }) => projectId));
    if (
      !(await returns.prepareGrantReturn(
        projects.filter((id) => !withheld.has(id)),
        returning,
      ))
    )
      return;
    await copies.rememberTeamAdmissions(changed);
    await update(local.filter(({ workbenchId }) => !withheld.has(workbenchId)));
  };
