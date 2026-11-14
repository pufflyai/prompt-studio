import { sessionSchema, workspaceSchema } from "pstdio-api-contracts";
import { z } from "zod";

export const deviceSchema = z.object({ ownerId: z.string(), id: z.string(), name: z.string() });
export const personalSessionSchema = sessionSchema.extend({
  device: deviceSchema,
  workspace_id: z.string().nullable(),
  approval_requests: z
    .array(z.object({ id: z.string(), toolName: z.string(), toolUseId: z.string(), toolInput: z.unknown() }))
    .optional(),
});
export const personalWorkspaceSchema = workspaceSchema.extend({ device: deviceSchema });
export const remoteSession = (
  row: z.infer<typeof personalSessionSchema>,
  login: { accountId: string; deviceId: string },
  projectId: string,
) => row.device.ownerId === login.accountId && row.device.id !== login.deviceId && row.project_id === projectId;
