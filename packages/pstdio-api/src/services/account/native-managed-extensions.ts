import {
  type ManagedExtension,
  managedExtensionSchema,
  managedPackageDescriptorSchema,
  type TeamMembershipWrite,
  teamExtensionPolicySchema,
} from "pstdio-sync-contracts";
import { z } from "zod";
import { AccountRequestError } from "./account-errors";
import { managedPackageRequest, readManagedPackageBytes, readManagedProjectGrant } from "./managed-package-client";
import { openManagedPackage, sealManagedPackage } from "./managed-package-crypto";
import { ManagerRequestDenied } from "./manager-client";
import type { createNativeManagerCall } from "./native-manager-call";
import { type DeviceLogin, matchesDeviceLogin } from "./native-store";
import { readPrivateFile, serializeNativeWrite, writePrivateFile } from "./private-file";
import type { createProjectCopyStore } from "./project-copy-store";

const policySchema = z.array(teamExtensionPolicySchema);
const cacheSchema = z.strictObject({
  teams: z.array(
    z.strictObject({
      managerOrigin: z.string(),
      accountId: z.string(),
      userId: z.string(),
      policy: policySchema,
    }),
  ),
});
const teamPath = (accountId: string) => `/v1/teams/${encodeURIComponent(accountId)}/managed-extensions`;
const canUseOfflinePolicy = (error: unknown) =>
  error instanceof TypeError || (error instanceof ManagerRequestDenied && error.status >= 500);
const accessDenied = (error: unknown) =>
  error instanceof AccountRequestError ||
  (error instanceof ManagerRequestDenied && (error.status === 401 || error.status === 403));
export type ManagedPackageSource = { extensionId: string; name: string; version: string; bytes: Blob };
type Manage = Extract<TeamMembershipWrite, { op: "manageExtension" }>;

export const createNativeManagedExtensions = (input: {
  file: string;
  current: () => Promise<DeviceLogin>;
  readLogin: () => Promise<DeviceLogin | null>;
  copies: Pick<
    ReturnType<typeof createProjectCopyStore>,
    "teamProjects" | "teamAdmissions" | "recordTeamAdmissionAccess"
  >;
  call: ReturnType<typeof createNativeManagerCall>;
  signal: AbortSignal;
  refresh: () => Promise<void>;
  retryProject: (projectId: string) => Promise<unknown>;
}) => {
  const file = `${input.file}.managed-extensions.json`;
  const changed = async (accountId: string) => {
    await input.refresh();
    for (const project of await input.copies.teamProjects())
      if (project.accountId === accountId) await input.retryProject(project.projectId);
  };
  let exportPackage: ((projectId: string, instanceId: string) => Promise<ManagedPackageSource>) | undefined;
  const assertCurrent = async (login: DeviceLogin) => {
    if (!matchesDeviceLogin(await input.readLogin(), login))
      throw new AccountRequestError("The signed-in account changed");
  };
  const readCache = () => readPrivateFile(file, cacheSchema, { teams: [] });
  const binding = async (projectId: string) =>
    (await input.copies.teamProjects()).find((row) => row.projectId === projectId);
  const admittedCache = async (
    projectId: string,
    owner: { managerOrigin: string; accountId: string },
    login: DeviceLogin,
  ) => {
    const admission = (await input.copies.teamAdmissions(login)).find(
      (row) => row.projectId === projectId && row.accountId === owner.accountId && !row.revoked,
    );
    if (!admission) throw new AccountRequestError("Connect to Cloud to verify this project's access first");
    const cached = (await readCache()).teams.find(
      (row) =>
        row.managerOrigin === owner.managerOrigin &&
        row.accountId === owner.accountId &&
        row.userId === login.accountId,
    );
    await assertCurrent(login);
    return cached?.policy;
  };
  const prune = () =>
    serializeNativeWrite(file, async () => {
      const needed = new Set(
        (await input.copies.teamProjects()).map(({ managerOrigin, accountId }) =>
          JSON.stringify([managerOrigin, accountId]),
        ),
      );
      const cached = await readCache();
      const teams = cached.teams.filter((row) => needed.has(JSON.stringify([row.managerOrigin, row.accountId])));
      if (teams.length !== cached.teams.length) await writePrivateFile(file, { teams });
    });
  const projectPolicy = async (projectId: string, signal?: AbortSignal) => {
    const owner = await binding(projectId);
    if (!owner) return [];
    const login = await input.current();
    if (login.managerOrigin !== owner.managerOrigin)
      throw new AccountRequestError("Sign in to this project's Cloud service first");
    try {
      const grantId = await readManagedProjectGrant({
        call: input.call,
        login,
        accountId: owner.accountId,
        projectId,
        signal,
      });
      await assertCurrent(login);
      await input.copies.recordTeamAdmissionAccess(login, projectId, grantId);
      const policy = policySchema.parse(
        await input.call(`${teamPath(owner.accountId)}/policy`, undefined, login.token, signal, login, true),
      );
      await assertCurrent(login);
      await serializeNativeWrite(file, async () => {
        await assertCurrent(login);
        const cached = await readCache();
        const teams = cached.teams.filter(
          (row) => row.managerOrigin !== owner.managerOrigin || row.accountId !== owner.accountId,
        );
        teams.push({ managerOrigin: owner.managerOrigin, accountId: owner.accountId, userId: login.accountId, policy });
        await writePrivateFile(file, { teams });
      });
      await assertCurrent(login);
      return policy;
    } catch (error) {
      if (signal?.aborted || input.signal.aborted) throw error;
      await assertCurrent(login);
      if (accessDenied(error)) await input.copies.recordTeamAdmissionAccess(login, projectId, null);
      if (!canUseOfflinePolicy(error)) throw error;
      const cached = await admittedCache(projectId, owner, login);
      if (!cached) throw new AccountRequestError("Connect to Cloud to load this team's extension policy first");
      return cached;
    }
  };
  // Account refresh updates this native decision snapshot. Individual data mutations must not
  // issue manager requests; activation and package downloads still verify current project grants.
  const cachedProjectPolicy = async (projectId: string) => {
    input.signal.throwIfAborted();
    const owner = await binding(projectId);
    if (!owner) return [];
    const login = await input.current();
    if (login.managerOrigin !== owner.managerOrigin)
      throw new AccountRequestError("Sign in to this project's Cloud service first");
    const cached = await admittedCache(projectId, owner, login);
    input.signal.throwIfAborted();
    return cached ?? projectPolicy(projectId);
  };
  const manage = async (request: Manage, login: DeviceLogin) => {
    if (!exportPackage) throw new AccountRequestError("Extension packaging is unavailable on this host");
    const source = await exportPackage(request.projectId, request.instanceId);
    await assertCurrent(login);
    const sealed = await sealManagedPackage(request.accountId, source, source.bytes);
    await assertCurrent(login);
    try {
      const response = await managedPackageRequest(login, `${teamPath(request.accountId)}/packages`, {
        bytes: sealed.bytes,
        descriptor: { ...sealed.descriptor, expectedSelection: request.expectedSelection },
        signal: input.signal,
      });
      const selected = managedExtensionSchema.parse(await response.json());
      await assertCurrent(login);
      if (selected.extensionId !== source.extensionId || selected.revision !== sealed.descriptor.revision)
        throw new AccountRequestError("The Cloud service returned a different managed package");
      await changed(request.accountId);
      return selected;
    } catch (error) {
      if (error instanceof AccountRequestError) throw error;
      if (error instanceof ManagerRequestDenied && error.status === 409)
        throw new AccountRequestError("Team extension policy changed; reload and try again");
      if (error instanceof ManagerRequestDenied && error.status === 403)
        throw new AccountRequestError("Only the team owner can manage required extensions");
      throw new AccountRequestError("The managed package could not be saved. Check Cloud access and try again.");
    }
  };
  const download = async (projectId: string, required: ManagedExtension, signal?: AbortSignal) => {
    const owner = await binding(projectId);
    const login = await input.current();
    if (!owner || owner.managerOrigin !== login.managerOrigin)
      throw new AccountRequestError("This team project is unavailable");
    const grantId = await readManagedProjectGrant({
      call: input.call,
      login,
      accountId: owner.accountId,
      projectId,
      signal,
    });
    await assertCurrent(login);
    const query = new URLSearchParams({ workbenchId: projectId, grantId, selectionId: required.selectionId });
    const response = await managedPackageRequest(
      login,
      `${teamPath(owner.accountId)}/${encodeURIComponent(required.extensionId)}/package?${query}`,
      { signal: AbortSignal.any([input.signal, ...(signal ? [signal] : [])]) },
    );
    try {
      const header = response.headers.get("x-pstdio-package");
      if (!header || header.length > 8192) throw new Error("Managed package descriptor is unavailable");
      const descriptor = managedPackageDescriptorSchema.parse(JSON.parse(Buffer.from(header, "base64url").toString()));
      if (
        descriptor.extensionId !== required.extensionId ||
        descriptor.revision !== required.revision ||
        descriptor.version !== required.version
      )
        throw new Error("Managed package does not match its team policy");
      const bytes = await readManagedPackageBytes(response);
      await assertCurrent(login);
      const opened = await openManagedPackage(owner.accountId, descriptor, bytes);
      await assertCurrent(login);
      return opened;
    } finally {
      await response.body?.cancel().catch(() => {});
    }
  };
  return {
    projectPolicy,
    cachedProjectPolicy,
    download,
    manage,
    prune,
    changed,
    connect: (source: NonNullable<typeof exportPackage>) => {
      exportPackage = source;
    },
    required: async (projectId: string, extensionId: string) =>
      Boolean((await projectPolicy(projectId)).find((row) => row.extensionId === extensionId)?.required),
  };
};
