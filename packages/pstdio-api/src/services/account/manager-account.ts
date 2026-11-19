import { identitySchema, projectDeletionStatusSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { apiLogger } from "../../lib/logger";
import { ManagerRequestDenied, managerRequest } from "./manager-client";
import { matchesDeviceAccount } from "./native-device-read";
import type { DeviceLogin } from "./native-store";

const workbenchesSchema = z.array(z.object({ workbenchId: identitySchema }));
const accountSchema = z.object({
  features: z.object({ relay: z.boolean() }),
  projectDeletion: z.boolean().optional(),
});

const deletionsSchema = z.array(projectDeletionStatusSchema);

type ManagerIdentity = Pick<DeviceLogin, "managerOrigin" | "accountId" | "deviceId"> & { credential: string };
export const matchesManagerLogin = (snapshot: ManagerIdentity | undefined, login: DeviceLogin | null) =>
  Boolean(
    snapshot &&
      login &&
      snapshot.credential === login.token &&
      snapshot.deviceId === login.deviceId &&
      matchesDeviceAccount(snapshot, login),
  );

export const readManagerAccount = async (login: DeviceLogin, signal?: AbortSignal) => {
  const [account, projects] = await Promise.all([
    managerRequest(login.managerOrigin, "/v1/account", login.token, undefined, signal).then((data) =>
      accountSchema.parse(data),
    ),
    managerRequest(login.managerOrigin, "/v1/workbenches", login.token, undefined, signal).then((data) =>
      workbenchesSchema.parse(data),
    ),
  ]);
  const deletions =
    account.projectDeletion !== undefined
      ? await managerRequest(login.managerOrigin, "/v1/project-deletions", login.token, undefined, signal)
          .then((data) => deletionsSchema.parse(data))
          .catch((error) => {
            if (signal?.aborted || (error instanceof ManagerRequestDenied && [401, 403].includes(error.status)))
              throw error;
            apiLogger.warn({ event: "account.cloud_deletions.unavailable" }, "Cloud deletion status will load later");
            return undefined;
          })
      : [];
  return {
    managerOrigin: login.managerOrigin,
    accountId: login.accountId,
    deviceId: login.deviceId,
    credential: login.token,
    ids: projects.map((row) => row.workbenchId),
    ...account,
    projectDeletion: account.projectDeletion ?? false,
    deletions,
  };
};
