import { serviceAddress } from "pstdio-sync/relay";
import { identitySchema, projectDeletionStatusSchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { ScopedDeviceLogin } from "./native-store";
import { readPrivateFile, serializeNativeWrite, writePrivateFile } from "./private-file";

const copySchema = z.strictObject({
  managerOrigin: z.string().transform(serviceAddress),
  accountId: identitySchema,
  userId: identitySchema.optional(),
  deviceId: identitySchema,
  projectId: identitySchema,
  name: z.string(),
  phase: z.enum(["removing", "cloud-only", "downloading"]),
  automatic: z.literal(true).optional(),
});
const rosterSchema = z.strictObject({
  managerOrigin: z.string().transform(serviceAddress),
  accountId: identitySchema,
  userId: identitySchema.optional(),
  deviceId: identitySchema,
  ids: z.array(identitySchema),
  deletions: z.array(projectDeletionStatusSchema),
  projectDeletion: z.boolean(),
});
const teamProjectSchema = z.strictObject({
  projectId: identitySchema,
  accountId: identitySchema,
  managerOrigin: copySchema.shape.managerOrigin,
});
type TeamProject = z.infer<typeof teamProjectSchema>;
const teamAdmissionSchema = teamProjectSchema.extend({
  userId: identitySchema,
  deviceId: identitySchema,
  grantId: identitySchema,
});
export type TeamAdmission = z.infer<typeof teamAdmissionSchema>;

const copyFileSchema = z.strictObject({
  copies: z.array(copySchema),
  rosters: z.array(rosterSchema).default([]),
  teamProjects: z.array(teamProjectSchema).default([]),
  teamAdmissions: z.array(teamAdmissionSchema).default([]),
});
type ProjectRoster = z.infer<typeof rosterSchema>;

export type ProjectCopy = z.infer<typeof copySchema>;
type AccountDevice = Pick<ScopedDeviceLogin, "managerOrigin" | "accountId" | "userId" | "deviceId">;
type CopyIdentity = AccountDevice & Pick<ProjectCopy, "projectId">;

export const projectCopyAccount = ({ managerOrigin, accountId }: AccountDevice) => ({ managerOrigin, accountId });

const matches = (row: AccountDevice, identity: AccountDevice) =>
  row.managerOrigin === identity.managerOrigin &&
  row.accountId === identity.accountId &&
  row.userId === identity.userId &&
  row.deviceId === identity.deviceId;
const isCopy = (row: ProjectCopy, key: CopyIdentity) => row.projectId === key.projectId && matches(row, key);
const sameAdmission = (left: TeamAdmission, right: TeamAdmission) =>
  left.projectId === right.projectId && matches(left, right);

// The catalog survives logout without putting the choice or device credential into synced content.
export const createProjectCopyStore = (accountFile: string) => {
  const path = `${accountFile}.project-copies.json`;
  const read = () =>
    readPrivateFile(path, copyFileSchema, { copies: [], rosters: [], teamProjects: [], teamAdmissions: [] });
  return {
    teamProjects: () => serializeNativeWrite(path, async () => (await read()).teamProjects),
    teamAdmissions: (login: Pick<ScopedDeviceLogin, "managerOrigin" | "accountId" | "deviceId">) =>
      serializeNativeWrite(path, async () =>
        (await read()).teamAdmissions.filter(
          (row) =>
            row.managerOrigin === login.managerOrigin &&
            row.userId === login.accountId &&
            row.deviceId === login.deviceId,
        ),
      ),
    rememberTeamAdmissions: (admitted: TeamAdmission[]) =>
      serializeNativeWrite(path, async () => {
        const current = await read();
        const previous = current.teamAdmissions.filter((row) => !admitted.some((next) => sameAdmission(row, next)));
        await writePrivateFile(path, {
          ...current,
          teamAdmissions: [...previous, ...admitted.map((row) => teamAdmissionSchema.parse(row))],
        });
      }),
    bindTeamProject: (binding: TeamProject, canClaim: () => Promise<boolean>) =>
      serializeNativeWrite(path, async () => {
        const current = await read();
        const existing = current.teamProjects.find(({ projectId }) => projectId === binding.projectId);
        if (existing)
          return existing.accountId === binding.accountId && existing.managerOrigin === binding.managerOrigin;
        if (!(await canClaim())) return false;
        await writePrivateFile(path, {
          ...current,
          teamProjects: [...current.teamProjects, teamProjectSchema.parse(binding)],
        });
        return true;
      }),
    forAccount: (identity: AccountDevice) =>
      serializeNativeWrite(path, async () => (await read()).copies.filter((row) => matches(row, identity))),
    forDevice: (deviceId: string) =>
      serializeNativeWrite(path, async () => (await read()).copies.filter((row) => row.deviceId === deviceId)),
    roster: (identity: AccountDevice) =>
      serializeNativeWrite(path, async () => (await read()).rosters.find((row) => matches(row, identity))),
    rememberRoster: (identity: AccountDevice, roster: Pick<ProjectRoster, "ids" | "deletions" | "projectDeletion">) =>
      serializeNativeWrite(path, async () => {
        const current = await read();
        const { managerOrigin, accountId, userId, deviceId } = identity;
        const next = rosterSchema.parse({ managerOrigin, accountId, userId, deviceId, ...roster });
        const previous = current.rosters.find((row) => matches(row, identity));
        if (JSON.stringify(previous) === JSON.stringify(next)) return;
        const otherDevices = current.rosters.filter((row) => !matches(row, identity));
        await writePrivateFile(path, { ...current, rosters: [...otherDevices, next] });
      }),
    recordDiscovery: (record: ProjectCopy) =>
      serializeNativeWrite(path, async () => {
        const current = await read();
        const copy = copySchema.parse(record);
        const existing = current.copies.find((row) => isCopy(row, copy));
        if (existing) return existing.phase === "downloading";
        await writePrivateFile(path, { ...current, copies: [...current.copies, copy] });
        return true;
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
