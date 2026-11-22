import type { BackendSurface } from "./surface";

/**
 * Host services whose members are asynchronous calls with plain-data arguments and results.
 * Members that take callbacks, return streams or return live handles are listed in
 * `UNSUPPORTED_CONTEXT_MEMBERS` instead, so every ctx function is accounted for.
 */
type Members = Record<string, BackendSurface>;

const object = (members: Members): BackendSurface => ({ kind: "object", members });
const calls = (...names: string[]): Members => Object.fromEntries(names.map((name) => [name, { kind: "async" }]));

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
  process: object(calls("run", "runOrThrow", "spawnDetached")),
  net: object(calls("findFreePort")),
  connections: object({ ...calls("request"), stream: { kind: "iterate" } }),
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

/**
 * Context functions that need callbacks, streams, live handles or synchronous host data, which a
 * later stage adds. Storage entries apply at every `storage.scope(...)` depth.
 */
export const UNSUPPORTED_CONTEXT_MEMBERS = [
  "storage.positions",
  "storage.assets",
  // Offered by the SDK's in-memory test storage only; the host ctx has no records.transaction.
  "storage.records.transaction",
  "storage.files.urlFor",
  "storage.collection.attachments.urlFor",
  "storage.scope.records.id",
  "stream.close",
  "terminal",
  "localDirectory",
] as const;

/** Host helpers present on ctx objects but not part of the public extension API. Never exposed. */
const HOST_ONLY_CONTEXT_MEMBERS = ["resources.removedLinks"] as const;

export const isUnsupportedContextMember = (path: string) => {
  if (HOST_ONLY_CONTEXT_MEMBERS.some((member) => path === member)) return true;
  const candidates = [path, path.replace(/^storage(\.scope)+(?=\.)/, "storage")];
  if (path.startsWith("storage.scope.") && path.endsWith(".records.id")) return true;
  return UNSUPPORTED_CONTEXT_MEMBERS.some((member) =>
    candidates.some((candidate) => candidate === member || candidate.startsWith(`${member}.`)),
  );
};
