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
const commandQuery = z.object({
  owner: identifier,
  requestId: identifier,
  command: command.omit({ metadata: true }).strict(),
  dependsOn: z.array(identifier).optional(),
  dependency: z
    .object({
      projectId: identifier.optional(),
      extensionId: identifier.optional(),
      recordId: identifier.optional(),
      recordIds: z.array(identifier).optional(),
      resourceKey: identifier.optional(),
      resourceId: identifier.optional(),
      fields: z.array(identifier).optional(),
    })
    .optional(),
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

const serviceQuery = (source: z.ZodType) =>
  z.discriminatedUnion("operation", [
    z.strictObject({
      operation: z.enum(["observe", "read", "refresh"]),
      owner: identifier,
      requestId: identifier,
      source,
    }),
    z.strictObject({ operation: z.literal("close"), owner: identifier, requestId: identifier }),
  ]);
const accountQuery = serviceQuery(
  z.discriminatedUnion("service", [
    z.strictObject({ service: z.literal("status") }),
    z.strictObject({ service: z.literal("projectSyncStatus"), projectId: identifier }),
    z.strictObject({ service: z.literal("devices"), accountId: identifier, managerOrigin: identifier }),
  ]),
);
const performanceQuery = serviceQuery(z.strictObject({ service: z.literal("snapshot") }));
const resourceActionChoices = z
  .array(
    z
      .object({
        kind: z.literal("action").optional(),
        closeOnSelect: z.boolean().optional(),
        id: z.string().min(1).max(200),
        label: z.string().trim().min(1).max(1000),
        selected: z.boolean().optional(),
        disabled: z.boolean().optional(),
      })
      .strict()
      .refine((choice) => choice.kind !== "action" || !choice.selected, "Action rows cannot be selected"),
  )
  .min(1)
  .max(1024)
  .refine((choices) => new Set(choices.map((choice) => choice.id)).size === choices.length, "Choice IDs must be unique")
  .refine(
    (choices) => choices.filter((choice) => choice.selected).length <= 1,
    "A choice group has one selected value",
  );

const schemas = {
  "performance.read": z.discriminatedUnion("operation", [
    z.strictObject({ operation: z.literal("query"), query: performanceQuery }),
    z.strictObject({
      operation: z.enum(["state", "snapshot", "subscribe", "unsubscribe", "recordings", "retain", "dispose"]),
    }),
  ]),
  "performance.control": z.discriminatedUnion("operation", [
    z.strictObject({ operation: z.literal("set-enabled"), enabled: z.boolean() }),
    z.strictObject({ operation: z.enum(["pause-extension", "resume-extension"]), installedExtensionId: identifier }),
  ]),
  "harnesses.read": z.object({ harnessId: identifier.optional(), model: z.string().optional() }),
  "resources.changes.observed": z.strictObject({ receipt: z.string().min(1).max(16000).nullable() }),
  "resources.actions.register": z.discriminatedUnion("operation", [
    z.object({
      operation: z.literal("register"),
      registrationId: z.string().uuid(),
      resource: extensionResourceRefSchema,
      label: z.string().trim().min(1).max(200),
      icon: z.string().max(100).optional(),
      choices: resourceActionChoices.optional(),
    }),
    z.object({
      operation: z.literal("update-choices"),
      registrationId: z.string().uuid(),
      choices: resourceActionChoices,
      label: z.string().trim().min(1).max(200).optional(),
    }),
    z.object({ operation: z.literal("unregister"), registrationId: z.string().uuid() }),
    z.object({
      operation: z.literal("complete"),
      requestId: z.string().uuid(),
      error: z.string().max(2000).optional(),
    }),
  ]),
  "resources.actions": z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("list"), resource: extensionResourceRefSchema }),
    z.object({ operation: z.literal("execute"), resource: extensionResourceRefSchema, key: identifier }),
  ]),
  "commands.execute": command,
  "commands.query": z.discriminatedUnion("operation", [
    commandQuery.extend({ operation: z.enum(["observe", "read", "refresh"]) }).strict(),
    z.strictObject({ operation: z.literal("close"), owner: identifier, requestId: identifier }),
  ]),
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
  "preferences.get": z.union([
    preference,
    z.strictObject({
      op: z.literal("query"),
      query: serviceQuery(preference.extend({ service: z.literal("preference") })),
    }),
  ]),
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
  "files.download": z.object({
    name: identifier
      .regex(/^[^/\\]+$/)
      .refine((name) => name !== "." && name !== ".." && [...name].every((char) => char.charCodeAt(0) >= 32)),
    data: binary,
    mimeType: z.string().optional(),
  }),
  "files.delete": z.object({ id: identifier }),
  "artifacts.read": z.discriminatedUnion("op", [
    z.object({ op: z.literal("list"), mount: identifier, prefix: z.string().optional() }),
    z.object({ op: z.literal("readText"), mount: identifier, path: z.string() }),
    z.object({ op: z.literal("imageUrl"), mount: identifier, path: z.string() }),
  ]),
  "account.read": z.discriminatedUnion("op", [
    z.strictObject({ op: z.literal("query"), query: accountQuery }),
    z.object({ op: z.literal("status") }),
    z.object({ op: z.literal("loginStatus"), id: identifier }),
    z.object({ op: z.literal("devices") }),
    z.object({ op: z.literal("projectSyncStatus"), ...projectId }),
  ]),
  "account.manage": z.discriminatedUnion("op", [
    z.object({ op: z.literal("retryProjectSyncSource"), sourceId: identifier, ...projectId }),
    z.object({ op: z.literal("login"), managerOrigin: identifier.optional() }),
    z.object({ op: z.literal("cancelLogin"), id: identifier }),
    z.object({ op: z.literal("logout") }),
    z.object({ op: z.literal("renameDevice"), id: identifier, name: z.string() }),
    z.object({ op: z.literal("removeDevice"), id: identifier }),
    z.object({ op: z.literal("syncProject"), ...projectId }),
    z.object({ op: z.literal("stopProjectSync"), ...projectId }),
    z.object({
      op: z.literal("resolveReturnedChanges"),
      action: z.enum(["apply", "discard", "dismiss"]),
      ...projectId,
    }),
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
