import type { BackendSurface } from "./surface";

/**
 * Host service methods and streaming members that are reachable through the worker's ctx.
 * The coverage check compares these declarations with the real host context.
 */
type Members = Record<string, BackendSurface>;

const object = (members: Members) => ({ kind: "object", members }) satisfies BackendSurface;
const calls = (...names: string[]) =>
  Object.fromEntries<BackendSurface>(names.map((name) => [name, { kind: "async" }]));

const mountCalls = [
  "exists",
  "readText",
  "writeText",
  "updateText",
  "readBytes",
  "writeBytes",
  "list",
  "listDirs",
  "delete",
] as const;
const mount = object(calls(...mountCalls));

export const serviceSurfaces: Members = {
  resources: object(
    calls(
      "queryRelated",
      "observeChange",
      "resolveMany",
      "resolveOpenings",
      "addAnchors",
      "removeAnchors",
      "queryAnchors",
      "queryAnchorsMany",
      "listAnchors",
      "removed",
      "allocate",
      "allocateMany",
      "identity",
      "identityMany",
      "findByShorthand",
    ),
  ),
  views: object(calls("list", "create", "update", "remove", "reorder", "setDefault")),
  artifacts: object({ mount: { kind: "factory", returns: mount } }),
  projectFiles: mount,
  extensionFiles: mount,
  packageFiles: object(calls("exists", "readText", "readBytes", "list", "listDirs")),
  workspaceFiles: object(calls(...mountCalls, "syncDir")),
  files: object(calls("readText", "writeText", "createText", "delete")),
  skills: object(calls("list")),
  activity: object(
    calls(
      "capabilities",
      "query",
      "get",
      "publish",
      "resolve",
      "attach",
      "readAttachment",
      "handoff",
      "importEntry",
      "record",
    ),
  ),
  notify: object(calls("toast", "action", "setStatus", "setStatusByKey", "resolve", "dismiss")),
  automation: object(calls("enqueue", "get", "list", "cancel")),
  process: object({
    ...calls("run", "runOrThrow", "spawnDetached"),
    // The host owns the child; the worker's handle forwards to it and lives while the worker holds it.
    spawn: {
      kind: "handle",
      members: {
        id: "id",
        started: "promise",
        exited: "promise",
        write: "async",
        end: "async",
        kill: "async",
        events: "iterate",
      },
    },
  }),
  // Harness contexts only.
  targetFiles: object(calls("readText")),
  net: object(calls("findFreePort")),
  connections: object({ ...calls("request"), stream: { kind: "iterate", signalArg: 1 } }),
  account: object(
    calls(
      "status",
      "login",
      "loginStatus",
      "cancelLogin",
      "logout",
      "devices",
      "renameDevice",
      "removeDevice",
      "projectSyncStatus",
      "retryProjectSyncSource",
      "syncProject",
      "stopProjectSync",
      "resolveReturnedChanges",
    ),
  ),
  extensions: object(calls("list", "install")),
  workspaces: object(
    calls(
      "rename",
      "listFiles",
      "readFile",
      "createDirectory",
      "createFile",
      "writeFile",
      "moveEntry",
      "deleteEntry",
      "diffFiles",
      "diffFile",
      "diffSummary",
      "getCapacity",
      "updateCapacity",
      "listProviders",
      "getDefault",
      "query",
      "list",
      "get",
      "getByShorthand",
      "create",
      "addAnchors",
      "removeAnchors",
      "resolve",
      "cancel",
      "removeWorktree",
      "delete",
    ),
  ),
  sessions: object(
    calls(
      "getQueuedFollowUps",
      "updateQueuedFollowUp",
      "combineQueuedFollowUps",
      "steerQueuedFollowUp",
      "get",
      "query",
      "create",
      "followup",
      "stop",
      "addAnchors",
      "removeAnchors",
      "getExecutionState",
      "getConversation",
      "fork",
      "getForkState",
      "getConversationSources",
      "getQueuedMessages",
      "approve",
      "rename",
      "archive",
      "delete",
      "updateStatus",
      "listActivity",
      "removeQueuedFollowUp",
      "moveQueuedFollowUp",
      "getDraftHarnessCommands",
      "getHarnessCommands",
      "invokeHarnessOperation",
      "resolveSessionId",
      "uploadAttachment",
      "readAttachment",
      "deleteAttachment",
      "observeMetadata",
      "stream",
      "retainResources",
    ),
  ),
};

/** Context functions process mode does not offer. Storage entries apply at every `storage.scope(...)` depth. */
export const UNSUPPORTED_CONTEXT_MEMBERS = [
  // Offered by the SDK's in-memory test storage only; the host ctx has no records.transaction.
  "storage.records.transaction",
] as const;

/** Host helpers present on ctx objects but not part of the public extension API. Never exposed. */
const HOST_ONLY_CONTEXT_MEMBERS = ["resources.removedLinks", "stream.close"] as const;

export const isUnsupportedContextMember = (path: string) => {
  if (HOST_ONLY_CONTEXT_MEMBERS.some((member) => path === member)) return true;
  const candidates = [path, path.replace(/^storage(\.scope)+(?=\.)/, "storage")];
  return UNSUPPORTED_CONTEXT_MEMBERS.some((member) =>
    candidates.some((candidate) => candidate === member || candidate.startsWith(`${member}.`)),
  );
};
