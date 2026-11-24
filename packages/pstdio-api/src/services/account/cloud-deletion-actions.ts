import type { DeleteCloudProjectInput, ProjectCopyAccount, ProjectCopyDevice } from "pstdio-api-contracts";
import { accountScopedPath, identitySchema, projectDeletionStatusSchema } from "pstdio-sync-contracts";
import { requireProjectCopyAccount } from "./local-project-removal";
import { ManagerRequestDenied } from "./manager-client";
import type { createNativeManagerCall } from "./native-manager-call";
import { type ScopedDeviceLogin, scopedAccountId, signedInIdentity } from "./native-store";

const projectDeletionPath = (id: string) => `/v1/workbenches/${encodeURIComponent(identitySchema.parse(id))}/deletion`;

export const deletionReceipt = (input: unknown) => {
  const { workbenchId, ...deletion } = projectDeletionStatusSchema.parse(input);
  return { ...deletion, projectId: workbenchId };
};

const readDeletion = async (input: {
  id: string;
  signal?: AbortSignal;
  expected?: ProjectCopyAccount;
  expectedDevice?: ProjectCopyDevice;
  login(id: string, expectedDevice?: ProjectCopyDevice): Promise<ScopedDeviceLogin>;
  call: ReturnType<typeof createNativeManagerCall>;
  requireCurrent(login: ScopedDeviceLogin): Promise<void>;
}) => {
  const { id, signal, expected, expectedDevice } = input;
  const login = await input.login(id, expectedDevice);
  requireProjectCopyAccount(login, expected);
  try {
    const status = await input.call(
      accountScopedPath(projectDeletionPath(id), scopedAccountId(login)),
      undefined,
      login.token,
      signal,
      signedInIdentity(login),
      Boolean(login.userId),
    );
    await input.requireCurrent(login);
    return deletionReceipt(status);
  } catch (error) {
    if (error instanceof ManagerRequestDenied && error.status === 404) return null;
    throw error;
  }
};

export const createCloudDeletionActions = (input: {
  login(id: string, expectedDevice?: ProjectCopyDevice): Promise<ScopedDeviceLogin>;
  call: ReturnType<typeof createNativeManagerCall>;
  requireCurrent(login: ScopedDeviceLogin): Promise<void>;
  refresh(): Promise<void>;
}) => ({
  cloudProjectDeletion: (
    id: string,
    signal?: AbortSignal,
    expected?: ProjectCopyAccount,
    expectedDevice?: ProjectCopyDevice,
  ) => readDeletion({ id, signal, expected, expectedDevice, ...input }),
  async deleteCloudProject(id: string, body: DeleteCloudProjectInput, signal?: AbortSignal) {
    const login = await input.login(id, body.expectedDevice);
    requireProjectCopyAccount(login, body.expectedAccount);
    try {
      const status = await input.call(
        accountScopedPath(projectDeletionPath(id), scopedAccountId(login)),
        { confirm: body.confirm },
        login.token,
        signal,
        signedInIdentity(login),
        Boolean(login.userId),
      );
      await input.requireCurrent(login);
      return deletionReceipt(status);
    } finally {
      // Discover accepted work even when the deletion reply was lost.
      void input.refresh();
    }
  },
});
