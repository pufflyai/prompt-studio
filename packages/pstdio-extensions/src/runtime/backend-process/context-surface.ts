import { storagePositionsDevice } from "pstdio-api-contracts";
import { isNavigationScoped } from "../runner/host-context";
import { serviceSurfaces } from "./service-surfaces";
import type { BackendSurface } from "./surface";

type Members = Record<string, BackendSurface>;

const object = (members: Members): BackendSurface => ({ kind: "object", members });
const value: BackendSurface = { kind: "value" };
const notify: BackendSurface = { kind: "notify" };
const calls = (...names: string[]): Members => Object.fromEntries(names.map((name) => [name, { kind: "async" }]));
const values = (...names: string[]): Members => Object.fromEntries(names.map((name) => [name, value]));

type StorageData = { namespace?: string[]; deviceId?: string; filePrefix: string };

const blobs = (filePrefix: string) =>
  object({
    ...calls("put", "update", "get", "getBytes", "list", "delete"),
    urlFor: { kind: "local", name: "fileUrl", prefix: filePrefix },
  });

const collection = (filePrefix: string) =>
  object({
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
    attachments: { kind: "factory", returns: blobs(filePrefix) },
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
    id: namespace ? { kind: "local", name: "recordId", namespace } : { kind: "local", name: "scopedRecordId" },
  });

const log = object({ ...calls("append", "read"), follow: { kind: "iterate", signalArg: 0 } });

const storageMembers = ({
  projectId,
  namespace,
  deviceId,
  filePrefix,
}: StorageData & { projectId: string }): Members => ({
  ...calls("get", "set", "delete", "canMigrate", "readLegacy"),
  migrate: { kind: "migrate", projectId },
  observe: { kind: "subscribe" },
  text: { kind: "factory", returns: object(calls("edit")) },
  log: { kind: "factory", returns: log },
  assets: object({
    ...calls("getTransfer", "cancel", "read", "verifyComplete"),
    stage: { kind: "asset-stage" },
  }),
  ids: object({ create: { kind: "local", name: "storageId" } }),
  ...(deviceId ? { positions: object({ between: { kind: "local", name: "position", deviceId } }) } : {}),
  records: records(namespace),
  files: blobs(filePrefix),
  collection: { kind: "factory", returns: collection(filePrefix) },
});

/** Storage at the project scope; `scope(...)` resolves its record namespace in the worker. */
const storageSurface = (projectId: string, data: Omit<StorageData, "namespace">) => {
  // The host validates the scoped shape; the worker adds the scope's own records.id when it creates one.
  // Both read one snapshot of the selector, taken when the scope is selected.
  const scoped = { kind: "object", members: storageMembers({ ...data, projectId }) } satisfies BackendSurface;
  const scope = {
    kind: "factory",
    returns: scoped,
    snapshotArguments: true,
    scopeOf: projectId,
  } satisfies BackendSurface;
  scoped.members.scope = scope;
  return object({ ...storageMembers({ ...data, projectId, namespace: ["project", projectId, "kv"] }), scope });
};

type ContextData = {
  projectId: string;
  extensionId?: string;
  navigation?: unknown;
  storage?: unknown;
};

/** Describes only supported services that are present on this invocation's host context. */
export const extensionContextSurface = (context: ContextData): BackendSurface => {
  const { projectId, extensionId, storage } = context;
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
    storage: storageSurface(projectId, {
      deviceId: ((storage as { positions?: object } | undefined)?.positions as Record<symbol, string> | undefined)?.[
        storagePositionsDevice
      ],
      filePrefix: `/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(extensionId ?? "")}/files/`,
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
