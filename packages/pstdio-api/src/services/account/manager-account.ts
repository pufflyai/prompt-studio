import { identitySchema, projectDeletionStatusSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { managerRequest } from "./manager-client";
import type { DeviceLogin } from "./native-store";

const workbenchesSchema = z.array(z.object({ workbenchId: identitySchema }));
const accountSchema = z.object({
  features: z.object({ relay: z.boolean() }),
  projectDeletion: z.boolean().optional(),
});

const deletionsSchema = z.array(projectDeletionStatusSchema);

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
      ? deletionsSchema.parse(
          await managerRequest(login.managerOrigin, "/v1/project-deletions", login.token, undefined, signal),
        )
      : [];
  return {
    credential: login.token,
    ids: projects.map((row) => row.workbenchId),
    ...account,
    projectDeletion: account.projectDeletion ?? false,
    deletions,
  };
};
