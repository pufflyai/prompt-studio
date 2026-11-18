import { serviceAddress } from "pstdio-sync/relay";
import { identitySchema, projectDeletionStatusSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { DeviceLogin } from "./native-store";
import { readPrivateFile, serializeNativeWrite, writePrivateFile } from "./private-file";

const copySchema = z.strictObject({
  managerOrigin: z.string().transform(serviceAddress),
  accountId: identitySchema,
  deviceId: identitySchema,
  projectId: identitySchema,
  name: z.string(),
  phase: z.enum(["removing", "cloud-only", "downloading"]),
});
const rosterSchema = z.strictObject({
  managerOrigin: z.string().transform(serviceAddress),
  accountId: identitySchema,
  deviceId: identitySchema,
  ids: z.array(identitySchema),
  deletions: z.array(projectDeletionStatusSchema),
  projectDeletion: z.boolean(),
});
const copyFileSchema = z.strictObject({
  copies: z.array(copySchema),
  rosters: z.array(rosterSchema).default([]),
});
type ProjectRoster = z.infer<typeof rosterSchema>;

export type ProjectCopy = z.infer<typeof copySchema>;
type AccountDevice = Pick<DeviceLogin, "managerOrigin" | "accountId" | "deviceId">;
type CopyIdentity = AccountDevice & Pick<ProjectCopy, "projectId">;

const matches = (row: AccountDevice, identity: AccountDevice) =>
  row.managerOrigin === identity.managerOrigin &&
  row.accountId === identity.accountId &&
  row.deviceId === identity.deviceId;
const isCopy = (row: ProjectCopy, key: CopyIdentity) => row.projectId === key.projectId && matches(row, key);

// The catalog survives logout without putting the choice or device credential into synced content.
export const createProjectCopyStore = (accountFile: string) => {
  const path = `${accountFile}.project-copies.json`;
  const read = () => readPrivateFile(path, copyFileSchema, { copies: [], rosters: [] });
  return {
    forAccount: (identity: AccountDevice) =>
      serializeNativeWrite(path, async () => (await read()).copies.filter((row) => matches(row, identity))),
    forDevice: (deviceId: string) =>
      serializeNativeWrite(path, async () => (await read()).copies.filter((row) => row.deviceId === deviceId)),
    roster: (identity: AccountDevice) =>
      serializeNativeWrite(path, async () => (await read()).rosters.find((row) => matches(row, identity))),
    rememberRoster: (identity: AccountDevice, roster: Pick<ProjectRoster, "ids" | "deletions" | "projectDeletion">) =>
      serializeNativeWrite(path, async () => {
        const current = await read();
        const { managerOrigin, accountId, deviceId } = identity;
        const next = rosterSchema.parse({ managerOrigin, accountId, deviceId, ...roster });
        const previous = current.rosters.find((row) => matches(row, identity));
        if (JSON.stringify(previous) === JSON.stringify(next)) return;
        const otherDevices = current.rosters.filter((row) => !matches(row, identity));
        await writePrivateFile(path, { ...current, rosters: [...otherDevices, next] });
      }),
    write: (record: ProjectCopy) =>
      serializeNativeWrite(path, async () => {
        const current = await read();
        const copy = copySchema.parse(record);
        await writePrivateFile(path, {
          ...current,
          copies: [...current.copies.filter((row) => !isCopy(row, copy)), copy],
        });
      }),
    forget: (key: CopyIdentity) =>
      serializeNativeWrite(path, async () => {
        const current = await read();
        const kept = current.copies.filter((row) => !isCopy(row, key));
        if (kept.length !== current.copies.length) await writePrivateFile(path, { ...current, copies: kept });
      }),
  };
};
