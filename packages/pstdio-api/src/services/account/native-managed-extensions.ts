import {
  accountScopedPath,
  type ManagedExtension,
  managedExtensionSchema,
  managedPackageDescriptorSchema,
  type TeamMembershipWrite,
  teamExtensionPolicySchema,
} from "pstdio-sync-contracts";
import { z } from "zod";
import { AccountRequestError } from "./account-errors";
import { managedPackageRequest, readManagedPackageBytes } from "./managed-package-client";
import { openManagedPackage, sealManagedPackage } from "./managed-package-crypto";
import { managerWorkbenchesSchema } from "./manager-account";
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
export type ManagedPackageSource = { extensionId: string; name: string; version: string; bytes: Blob };
type Manage = Extract<TeamMembershipWrite, { op: "manageExtension" }>;

export const createNativeManagedExtensions = (input: {
  file: string;
  current: () => Promise<DeviceLogin>;
  readLogin: () => Promise<DeviceLogin | null>;
  copies: Pick<ReturnType<typeof createProjectCopyStore>, "teamProjects">;
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
      const policy = policySchema.parse(
        await input.call(`${teamPath(owner.accountId)}/policy`, undefined, login.token, signal, login, true),
      );
      await assertCurrent(login);
      await serializeNativeWrite(file, async () => {
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
      if (!(error instanceof TypeError || (error instanceof ManagerRequestDenied && error.status >= 500))) throw error;
      const cached = (await readCache()).teams.find(
        (row) =>
          row.managerOrigin === owner.managerOrigin &&
          row.accountId === owner.accountId &&
          row.userId === login.accountId,
      );
      if (!cached) throw new AccountRequestError("Connect to Cloud to load this team's extension policy first");
      return cached.policy;
    }
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
    const projects = managerWorkbenchesSchema.parse(
      await input.call(
        accountScopedPath("/v1/workbenches", owner.accountId),
        undefined,
        login.token,
        signal,
        login,
        true,
      ),
    );
    const grantId = projects.find(({ workbenchId }) => workbenchId === projectId)?.grantId;
    if (!grantId) throw new AccountRequestError("Current project access is required to install managed extensions");
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
