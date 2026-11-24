import type { TeamAccount } from "pstdio-sync-contracts";
import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "../relay/runtime";
import { matchesManagerLogin, type readManagerAccount } from "./manager-account";
import { ManagerRequestDenied } from "./manager-client";
import { partitionCloudProjects } from "./missing-project-recovery";
import { type DeviceLogin, type ScopedDeviceLogin, scopeDeviceLogin, signedInIdentity } from "./native-store";
import type { createNativeTeams } from "./native-teams";
import type { createProjectCloudCatalog } from "./project-cloud-catalog";

type CloudRoster = Awaited<ReturnType<typeof readManagerAccount>>;
const denied = (error: unknown) => error instanceof ManagerRequestDenied && error.status === 401;

const connectionFor = (login: ScopedDeviceLogin, workbenchId: string): RelayWorkbench => ({
  accountId: login.accountId,
  ...(login.userId && { userId: login.userId }),
  workbenchId,
  environmentId: login.deviceId,
  relayOrigin: login.relayOrigin,
  managerOrigin: login.managerOrigin,
  renewalGrant: login.token,
});

export const createNativeCloudState = () => {
  let personal: CloudRoster | undefined;
  let teamAccounts: TeamAccount[] = [];
  let teams = new Map<string, CloudRoster>();
  let online = false;
  const scopesFor = (login: DeviceLogin | null) =>
    [personal, ...teams.values()].filter(
      (snapshot): snapshot is CloudRoster => snapshot !== undefined && matchesManagerLogin(snapshot, login),
    );
  const clear = () => {
    personal = undefined;
    teamAccounts = [];
    teams.clear();
  };

  const readTeam = async (
    login: DeviceLogin,
    team: TeamAccount,
    catalog: Pick<ReturnType<typeof createProjectCloudCatalog>, "readCloud">,
    accept: ReturnType<typeof createNativeTeams>["acceptDiscovery"],
    signal: AbortSignal,
  ) => {
    try {
      const scoped = scopeDeviceLogin(login, team.accountId);
      const snapshot = await catalog.readCloud(scoped, signal);
      const ids: string[] = [];
      for (const id of snapshot.ids) {
        if (await accept(login, connectionFor(scoped, id))) ids.push(id);
      }
      return { ...snapshot, ids };
    } catch (error) {
      if (denied(error)) return undefined;
      const previous = teams.get(team.accountId);
      return matchesManagerLogin(previous, login) ? previous : undefined;
    }
  };

  return {
    online: () => online,
    personal: () => personal,
    snapshot: (login: ScopedDeviceLogin) => {
      const snapshot = login.userId ? teams.get(login.accountId) : personal;
      return matchesManagerLogin(snapshot, { ...login, ...signedInIdentity(login) }) ? snapshot : undefined;
    },
    projectsFor: (login: DeviceLogin | null) =>
      matchesManagerLogin(personal, login) ? scopesFor(login).flatMap(({ ids }) => ids) : undefined,
    teamStatus(login: DeviceLogin | null) {
      if (!matchesManagerLogin(personal, login) || !teamAccounts.length) return {};
      return {
        teamAccounts,
        teamProjects: Object.fromEntries(
          scopesFor(login)
            .filter(({ userId }) => userId !== undefined)
            .flatMap(({ accountId, ids }) => ids.map((id) => [id, accountId])),
        ),
      };
    },
    async load(input: {
      login: DeviceLogin | null;
      current: () => Promise<DeviceLogin | null>;
      reject: (login: DeviceLogin) => Promise<unknown>;
      catalog: Pick<ReturnType<typeof createProjectCloudCatalog>, "readCloud">;
      teams: Pick<ReturnType<typeof createNativeTeams>, "read" | "acceptDiscovery">;
      signal: AbortSignal;
    }) {
      const { login, catalog, signal } = input;
      online = false;
      if (!login) {
        clear();
        return;
      }
      if (!matchesManagerLogin(personal, login)) clear();
      try {
        personal = await catalog.readCloud(login, signal);
        online = true;
      } catch (error) {
        if (denied(error)) {
          await input.reject(login);
          clear();
        } else if (!signal.aborted) {
          apiLogger.warn({ event: "account.cloud_projects.unavailable" }, "Cloud projects will load later");
        }
        return;
      }
      const listed = await input.teams.read(login, signal).catch(() => undefined);
      if (!listed) return;
      const snapshots = await Promise.all(
        listed.map((team) => readTeam(login, team, catalog, input.teams.acceptDiscovery, signal)),
      );
      if (!matchesManagerLogin(personal, await input.current())) return;
      teams = new Map(snapshots.flatMap((snapshot) => (snapshot ? [[snapshot.accountId, snapshot]] : [])));
      teamAccounts = listed;
    },
    async connections(input: {
      login: DeviceLogin | null;
      catalog: Pick<ReturnType<typeof createProjectCloudCatalog>, "withdrawnProjectIds">;
      accept: ReturnType<typeof createNativeTeams>["acceptDiscovery"];
      exists: (id: string) => Promise<unknown>;
      recovering: (id: string) => boolean;
    }) {
      const { login } = input;
      if (!login) return { local: [], absent: [] };
      const grouped = await Promise.all(
        scopesFor(login).map(async (snapshot) => {
          const scoped = scopeDeviceLogin(login, snapshot.accountId);
          const candidates = [];
          for (const id of snapshot.ids) {
            const connection = connectionFor(scoped, id);
            if (await input.accept(login, connection)) candidates.push(id);
          }
          const withdrawn = await input.catalog.withdrawnProjectIds(scoped);
          const { local, absent } = await partitionCloudProjects(candidates, withdrawn, input.exists, input.recovering);
          return {
            local: local.map((id) => connectionFor(scoped, id)),
            absent: absent.map((id) => connectionFor(scoped, id)),
          };
        }),
      );
      return { local: grouped.flatMap(({ local }) => local), absent: grouped.flatMap(({ absent }) => absent) };
    },
  };
};
