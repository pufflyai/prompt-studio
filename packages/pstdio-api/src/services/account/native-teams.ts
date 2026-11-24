import { accountScopedPath, identitySchema, type TeamAccount, teamAccountSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { RelayWorkbench } from "../relay/runtime";
import { ManagerRequestDenied, managerRequest } from "./manager-client";
import { AccountRequestError } from "./native-account";
import { type DeviceReadIdentity, matchesDeviceAccount } from "./native-device-read";
import type { createNativeManagerCall } from "./native-manager-call";
import {
  type DeviceLogin,
  type ScopedDeviceLogin,
  scopeDeviceLogin,
  scopedAccountId,
  signedInIdentity,
} from "./native-store";
import type { createProjectCopyStore } from "./project-copy-store";

type Project = { id: string; name: string };
export const createNativeTeams = (input: {
  current: () => Promise<DeviceLogin>;
  call: ReturnType<typeof createNativeManagerCall>;
  copies: ReturnType<typeof createProjectCopyStore>;
  refresh: () => Promise<void>;
  personalProjects: (login: DeviceLogin) => Promise<string[] | undefined>;
  project: (id: string) => Promise<Project | null>;
}) => {
  const read = async (login: DeviceLogin, signal?: AbortSignal): Promise<TeamAccount[]> => {
    try {
      return z
        .array(teamAccountSchema)
        .parse(await managerRequest(login.managerOrigin, "/v1/teams", login.token, undefined, signal));
    } catch (error) {
      if (error instanceof ManagerRequestDenied && error.status === 404) return [];
      throw error;
    }
  };

  const owner = async (login: DeviceLogin, projectId: string): Promise<ScopedDeviceLogin> => {
    const binding = (await input.copies.teamProjects()).find((project) => project.projectId === projectId);
    if (!binding) return login;
    if (binding.managerOrigin !== login.managerOrigin)
      throw new AccountRequestError("This project belongs to a different Cloud service");
    return scopeDeviceLogin(login, binding.accountId);
  };

  const acceptDiscovery = async (login: DeviceLogin, connection: RelayWorkbench) => {
    const { accountId, workbenchId: projectId, managerOrigin } = connection;
    if (accountId === login.accountId)
      return !(await input.copies.teamProjects()).some((row) => row.projectId === projectId);
    if ((await input.personalProjects(login))?.includes(projectId)) return false;
    return input.copies.bindTeamProject(
      { accountId, managerOrigin, projectId },
      async () => !(await input.project(projectId)),
    );
  };

  const prepareProject = async (accountId: string) => {
    const login = await input.current();
    const team = (await read(login)).find((row) => row.accountId === accountId);
    if (team?.role !== "owner" || !team.features.relay)
      throw new AccountRequestError("Select a team you own with Cloud early access");
    const matches = async (projectId: string) => (await owner(login, projectId)).accountId === accountId;
    const sync = async (projectId: string) => {
      await input.call(
        accountScopedPath(`/v1/workbenches/${encodeURIComponent(projectId)}`, accountId),
        {},
        login.token,
        undefined,
        login,
        true,
      );
      await input.refresh();
    };
    return {
      matches,
      async reserve(projectId: string) {
        if (
          !(await input.copies.bindTeamProject(
            { accountId, managerOrigin: login.managerOrigin, projectId },
            async () => true,
          ))
        )
          throw new AccountRequestError("This project already belongs to another Cloud account");
      },
      sync,
    };
  };

  return {
    read,
    owner,
    acceptDiscovery,
    prepareProject,
    async localProjectNames(managerOrigin: string, accountId: string) {
      const rows = (await input.copies.teamProjects()).filter(
        (row) => row.managerOrigin === managerOrigin && row.accountId === accountId,
      );
      const projects = await Promise.all(rows.map(({ projectId }) => input.project(projectId)));
      return new Map(projects.flatMap((project) => (project ? [[project.id, project.name]] : [])));
    },
    async changeMembership(projectId: string, remove = false) {
      const login = await owner(await input.current(), projectId);
      const path = `/v1/workbenches/${encodeURIComponent(identitySchema.parse(projectId))}`;
      await input.call(
        accountScopedPath(path + (remove ? "/remove" : ""), scopedAccountId(login)),
        {},
        login.token,
        undefined,
        signedInIdentity(login),
        Boolean(login.userId),
      );
      await input.refresh();
      return { ok: true };
    },
    async list(signal?: AbortSignal) {
      const login = await input.current();
      const teams = await read(login, signal);
      if ((await input.current()).token !== login.token) throw new AccountRequestError("The signed-in account changed");
      return teams;
    },
    async create(name: string, expected?: DeviceReadIdentity) {
      const login = await input.current();
      if (expected && !matchesDeviceAccount(login, expected))
        throw new AccountRequestError("The signed-in account changed");
      const team = teamAccountSchema.parse(await input.call("/v1/teams", { name }, login.token, undefined, login));
      await input.refresh();
      const current = await input.current();
      if (current.token !== login.token || !matchesDeviceAccount(current, login))
        throw new AccountRequestError("The signed-in account changed");
      return team;
    },
  };
};
