import {
  extensionResourceRefSchema,
  jsonObjectSchema,
  pageParamValueSchema,
  textEditingRequestSchema,
} from "pstdio-api-contracts";
import type { WebviewHostCapability, WebviewHostCapabilityParams } from "pstdio-api-contracts/extension-kernel";
import { isNavigationTarget, type NavigationTarget } from "pstdio-api-contracts/extension-kernel";
import { z } from "zod";
import { webviewEditingSessionParamsSchema } from "./webview-editing-params";
import { webviewNotificationActionParamsSchema } from "./webview-notification-params";

export class WebviewHostCapabilityError extends Error {
  constructor(
    public code: string,
    message: string,
    public data: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WebviewHostCapabilityError";
  }
}

const identifier = z.string().min(1);
const empty = z.object({}).strict().optional();
const command = z.object({
  commandId: identifier,
  params: jsonObjectSchema.optional(),
  workspaceId: identifier.optional(),
  resource: extensionResourceRefSchema.optional(),
  metadata: jsonObjectSchema.optional(),
});
const streamId = { streamId: identifier };
const scope = z.object({
  scope: z.enum(["default", "user", "project", "workspace", "extension", "session"]),
  scopeId: z.string().optional(),
});
const preference = z.object({ name: identifier, scope: scope.optional() });
const notificationIdentity = z
  .object({
    id: identifier.optional(),
    dedupeKey: z.string().optional(),
    status: z.enum(["done", "dismissed", "expired"]).optional(),
  })
  .refine(
    (input) => input.id !== undefined || input.dedupeKey !== undefined,
    "Provide a notification ID or dedupe key.",
  );
const binary = z.union([z.instanceof(Uint8Array), z.instanceof(ArrayBuffer)]);
const fileScope = z.object({ type: identifier, id: z.string().optional() });
const terminalId = { sessionId: identifier };
const terminalRequest = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  command: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const projectId = { projectId: identifier.optional() };

const schemas = {
  "performance.read": z.strictObject({
    operation: z.enum(["state", "snapshot", "subscribe", "unsubscribe", "recordings", "retain", "dispose"]),
  }),
  "performance.control": z.discriminatedUnion("operation", [
    z.strictObject({ operation: z.literal("set-enabled"), enabled: z.boolean() }),
    z.strictObject({ operation: z.enum(["pause-extension", "resume-extension"]), installedExtensionId: identifier }),
  ]),
  "harnesses.read": z.object({ harnessId: identifier.optional(), model: z.string().optional() }),
  "resources.actions": z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("list"), resource: extensionResourceRefSchema }),
    z.object({ operation: z.literal("execute"), resource: extensionResourceRefSchema, key: identifier }),
  ]),
  "commands.execute": command,
  "editing.session": webviewEditingSessionParamsSchema,
  "editing.text": textEditingRequestSchema,
  "commands.stream": z.discriminatedUnion("operation", [
    command.extend({ ...streamId, operation: z.literal("start") }),
    z.object({ ...streamId, operation: z.literal("cancel") }),
    z.object({ ...streamId, operation: z.literal("ack"), bytes: z.number().int().positive() }),
  ]),
  "navigation.open": z.object({ target: z.custom<NavigationTarget>(isNavigationTarget, "Invalid navigation target.") }),
  "page.params.update": z.object({ params: z.record(z.string(), pageParamValueSchema.nullable()) }),
  "placement.close": empty,
  "notification.show": z.union([
    z.object({
      type: z.enum(["info", "success", "warning", "error"]),
      title: z.string().optional(),
      message: z.string(),
      metadata: jsonObjectSchema.optional(),
    }),
    z.object({
      level: z.enum(["info", "success", "warning", "error"]),
      title: z.string().optional(),
      message: z.string().optional(),
    }),
  ]),
  "notification.action": webviewNotificationActionParamsSchema,
  "notification.resolve": notificationIdentity,
  "notification.dismiss": notificationIdentity,
  "preferences.get": preference,
  "preferences.set": preference.extend({
    value: z.union([
      z.boolean(),
      z.number(),
      z.string(),
      z.array(z.string()),
      z.array(z.number()),
      z.array(z.boolean()),
      jsonObjectSchema,
    ]),
  }),
  "extension.settings.all": empty,
  "extension.settings.get": z.object({ key: identifier }),
  "extension.settings.set": z.object({ key: identifier, value: z.unknown() }),
  "extension.settings.delete": z.object({ key: identifier }),
  "terminal.session": z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("open"), request: terminalRequest }),
    z.object({ ...terminalId, operation: z.literal("write"), data: z.union([z.string(), z.instanceof(Uint8Array)]) }),
    z.object({
      ...terminalId,
      operation: z.literal("resize"),
      cols: z.number().int().positive(),
      rows: z.number().int().positive(),
    }),
    z.object({ ...terminalId, operation: z.literal("kill"), signal: z.string().optional() }),
    z.object({ ...terminalId, operation: z.literal("subscribe") }),
  ]),
  "files.upload": z.object({
    name: identifier,
    data: binary,
    mimeType: z.string().optional(),
    scope: fileScope.optional(),
  }),
  "files.list": z.object({ scope: fileScope.optional() }),
  "files.delete": z.object({ id: identifier }),
  "artifacts.read": z.discriminatedUnion("op", [
    z.object({ op: z.literal("list"), mount: identifier, prefix: z.string().optional() }),
    z.object({ op: z.literal("readText"), mount: identifier, path: z.string() }),
    z.object({ op: z.literal("imageUrl"), mount: identifier, path: z.string() }),
  ]),
  "account.read": z.discriminatedUnion("op", [
    z.object({ op: z.literal("status") }),
    z.object({ op: z.literal("loginStatus"), id: identifier }),
    z.object({ op: z.literal("devices") }),
    z.object({ op: z.literal("projectSyncStatus"), ...projectId }),
  ]),
  "account.manage": z.discriminatedUnion("op", [
    z.object({ op: z.literal("login"), managerOrigin: identifier.optional() }),
    z.object({ op: z.literal("cancelLogin"), id: identifier }),
    z.object({ op: z.literal("logout") }),
    z.object({ op: z.literal("renameDevice"), id: identifier, name: z.string() }),
    z.object({ op: z.literal("removeDevice"), id: identifier }),
    z.object({ op: z.literal("syncProject"), ...projectId }),
    z.object({ op: z.literal("stopProjectSync"), ...projectId }),
  ]),
} satisfies Record<WebviewHostCapability, z.ZodType>;

export const parseWebviewCapabilityParams = <Capability extends WebviewHostCapability>(
  capability: Capability,
  input: unknown,
) => {
  const result = schemas[capability].safeParse(input);
  if (!result.success)
    throw new WebviewHostCapabilityError("invalid_params", `Invalid parameters for ${capability}.`, {
      capability,
      issues: result.error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message })),
    });
  return result.data as WebviewHostCapabilityParams[Capability];
};
