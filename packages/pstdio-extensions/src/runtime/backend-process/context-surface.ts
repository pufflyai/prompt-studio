import { isNavigationScoped } from "../runner/host-context";
import { serviceSurfaces } from "./service-surfaces";
import type { BackendSurface } from "./surface";

type Members = Record<string, BackendSurface>;

const object = (members: Members): BackendSurface => ({ kind: "object", members });
const value: BackendSurface = { kind: "value" };
const notify: BackendSurface = { kind: "notify" };
const calls = (...names: string[]): Members => Object.fromEntries(names.map((name) => [name, { kind: "async" }]));
const values = (...names: string[]): Members => Object.fromEntries(names.map((name) => [name, value]));

// blobs.urlFor is synchronous and needs host URL data; it joins the surface with the other local helpers.
const blobs = object(calls("put", "update", "get", "getBytes", "list", "delete"));

const collection = object({
  ...calls(
    "read",
    "get",
    "list",
    "put",
    "update",
    "updateIfUnchanged",
    "createIfAbsent",
    "deleteIfValue",
    "create",
    "delete",
  ),
  attachments: { kind: "factory", returns: blobs },
});

const records = (namespace?: string[]) =>
  object({
    ...calls(
      "read",
      "readMany",
      "list",
      "query",
      "aggregate",
      "defineIndexes",
      "commit",
      "commitIfCurrent",
      "outcome",
      "conflicts",
      "inspect",
      "resolve",
    ),
    ...(namespace ? { id: { kind: "local", name: "recordId", namespace } } : {}),
  });

const log = object({ ...calls("append", "read"), follow: { kind: "iterate" } });

const storageMembers = (namespace?: string[]): Members => ({
  ...calls("get", "set", "delete", "canMigrate", "readLegacy", "migrate"),
  observe: { kind: "subscribe" },
  text: { kind: "factory", returns: object(calls("edit")) },
  log: { kind: "factory", returns: log },
  ids: object({ create: { kind: "local", name: "storageId" } }),
  records: records(namespace),
  files: blobs,
  collection: { kind: "factory", returns: collection },
});

// A scope's record namespace is resolved by the host, so scoped storage does not offer records.id yet.
const scopedStorage = { kind: "object", members: storageMembers() } satisfies BackendSurface;
scopedStorage.members.scope = { kind: "factory", returns: scopedStorage };

type ContextData = { projectId: string; navigation?: unknown };

/** Describes only supported services that are present on this invocation's host context. */
export const extensionContextSurface = (context: ContextData): BackendSurface => {
  const services: Members = {
    ...serviceSurfaces,
    logger: object({ info: notify, warn: notify, error: notify }),
    navigation: object({
      open: isNavigationScoped(context.navigation) ? { kind: "notify", check: "navigationTarget" } : notify,
    }),
    stream: object(calls("write")),
    commands: object({
      ...calls("execute"),
      ...Object.fromEntries(
        (["continue", "patchParams", "replaceParams", "replaceInvocation", "reject"] as const).map((type) => [
          type,
          { kind: "local", name: "middlewareResult", type },
        ]),
      ),
    }),
    events: object(calls("emit")),
    settings: object(calls("all", "get", "set", "delete")),
    storage: object({
      ...storageMembers(["project", context.projectId, "kv"]),
      scope: { kind: "factory", returns: scopedStorage },
    }),
  };
  return object({
    ...values(
      "projectId",
      "workspaceId",
      "project",
      "extensionId",
      "name",
      "source",
      "commandId",
      "invocationId",
      "invocation",
      "resource",
      "attachment",
      "slot",
      "eventId",
      "deliveryId",
    ),
    signal: { kind: "signal" },
    ...Object.fromEntries(
      Object.entries(services).filter(([name]) => (context as Record<string, unknown>)[name] != null),
    ),
  });
};

export const emptySurface: BackendSurface = { kind: "object", members: {} };
