import { type RouteConfig, z } from "@hono/zod-openapi";
import { type DeviceCommand, deviceCommandResultSchema } from "pstdio-api-contracts";
import { AccountRequestError } from "../../services/account/native-account";
import type { AppRouteHandler } from "../../types";
import type { RouteDeps } from "../deps";

/** Shared relay boundary for HTTP routes and project-scoped extension services. */
export const readDeviceCommandResult = async (
  account: RouteDeps["accountService"],
  projectId: string,
  deviceId: string,
  command: DeviceCommand,
  signal: AbortSignal,
) => {
  let result: z.infer<typeof deviceCommandResultSchema>;
  try {
    result = deviceCommandResultSchema.parse(await account.sendDeviceCommand(projectId, deviceId, command, signal));
  } catch (error) {
    if (!(error instanceof AccountRequestError)) throw error;
    result = { body: { error: error.message }, status: 400 };
  }
  return result;
};

export const deviceCommandResponse = async <R extends RouteConfig>(
  route: R,
  account: RouteDeps["accountService"],
  projectId: string,
  deviceId: string,
  command: DeviceCommand,
  signal: AbortSignal,
  device?: { ownerId: string; id: string; name: string },
) => {
  const result = await readDeviceCommandResult(account, projectId, deviceId, command, signal);
  const response = route.responses[result.status];
  const schema = response && "content" in response ? response.content?.["application/json"]?.schema : undefined;
  if (!(schema instanceof z.ZodType)) throw new Error("Unexpected device action response");
  let body = result.body;
  if (command.type === "workspace.readFile" && body && typeof body === "object" && "editable" in body)
    body = { ...body, editable: false };
  if (device && body && typeof body === "object" && "id" in body) body = { ...body, device };
  return Response.json(schema.parse(body), { status: result.status }) as Awaited<ReturnType<AppRouteHandler<R>>>;
};

export const remoteCreationDevice = async (account: RouteDeps["accountService"], deviceId?: string) => {
  if (!deviceId) return undefined;
  const { login } = await account.status();
  if (login?.deviceId === deviceId) return undefined;
  if (!login) return { id: deviceId, identity: undefined };
  const name = (await account.devices()).find((device) => device.id === deviceId)?.name ?? deviceId;
  return { id: deviceId, identity: { ownerId: login.accountId, id: deviceId, name } };
};
