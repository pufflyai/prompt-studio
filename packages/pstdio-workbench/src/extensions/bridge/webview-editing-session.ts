import {
  applyEditingChanges,
  diffEditingState,
  type JsonObject,
  rebaseEditingChanges,
  type WebviewCommandsExecuteParams,
  type WebviewEditingChange,
  type WebviewEditingSessionParams,
  type WebviewEditingSnapshot,
} from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore } from "../../core";

interface Member {
  id: string;
  events: HostEventPublisher;
  document: EditingDocument;
}
interface EditingDocument {
  key: string;
  scope: string;
  value: JsonObject;
  saved: JsonObject;
  version: number;
  revision: number;
  savedRevision: number;
  save: WebviewCommandsExecuteParams;
  execute: (input: WebviewCommandsExecuteParams) => Promise<unknown>;
  members: Set<Member>;
  previews: Map<Member, WebviewEditingChange[]>;
  writing: Promise<void> | null;
}
interface Owner {
  projectId: string;
  extensionId: string;
  events: HostEventPublisher;
}
type OpenRequest = Extract<WebviewEditingSessionParams, { operation: "open" }>;
const fail = (code: string) => Object.assign(new Error(code), { code });
const ownerScope = (owner: Owner) => JSON.stringify([owner.projectId, owner.extensionId]);

const snapshot = (document: EditingDocument) =>
  ({
    value: applyEditingChanges(document.value, [...document.previews.values()].flat()),
    version: document.version,
    revision: document.revision,
    savedRevision: document.savedRevision,
  }) satisfies WebviewEditingSnapshot;
const publish = (document: EditingDocument, accepted?: { member: Member; sequence: number }) => {
  document.version++;
  const current = snapshot(document);
  for (const member of document.members)
    member.events.emit({
      scope: "editing.session",
      payload: {
        sessionId: member.id,
        snapshot: current,
        ...(accepted?.member === member ? { appliedSequence: accepted.sequence } : {}),
      },
    });
};

const preview = (member: Member, input: Extract<WebviewEditingSessionParams, { changes: unknown }>) => {
  const document = member.document;
  const draft = applyEditingChanges(document.value, document.previews.get(member) ?? []);
  const next = applyEditingChanges(draft, input.changes);
  const previews = new Map(document.previews);
  previews.delete(member);
  previews.set(member, diffEditingState(document.value, next));
  applyEditingChanges(document.value, [...previews.values()].flat());
  document.previews = previews;
  publish(document, { member, sequence: input.sequence });
};
const commit = (member: Member, input: Extract<WebviewEditingSessionParams, { changes: unknown }>) => {
  const document = member.document;
  const changes = [...(document.previews.get(member) ?? []), ...input.changes];
  const value = applyEditingChanges(document.value, changes);
  const previews = new Map(document.previews);
  previews.delete(member);
  const rebased = rebaseEditingChanges(value, previews);
  document.value = value;
  document.previews = rebased.drafts;
  if (changes.length) document.revision++;
  publish(document, { member, sequence: input.sequence });
};
const cancel = (member: Member) => {
  const document = member.document;
  if (!document.previews.has(member)) return;
  const previews = new Map(document.previews);
  previews.delete(member);
  document.previews = rebaseEditingChanges(document.value, previews).drafts;
  publish(document);
};
const refresh = (document: EditingDocument, input: Extract<WebviewEditingSessionParams, { operation: "refresh" }>) => {
  if (input.expectedVersion !== document.version || document.savedRevision !== document.revision) return;
  const value = structuredClone(input.value);
  const rebased = rebaseEditingChanges(value, document.previews);
  document.value = value;
  document.saved = structuredClone(value);
  document.previews = rebased.drafts;
  publish(document);
  return snapshot(document);
};
const createDocument = (owner: Owner, key: string, input: OpenRequest, execute: EditingDocument["execute"]) => {
  const document: EditingDocument = {
    key,
    scope: ownerScope(owner),
    value: structuredClone(input.initial),
    saved: structuredClone(input.initial),
    version: 0,
    revision: 0,
    savedRevision: 0,
    save: structuredClone(input.save),
    execute,
    members: new Set(),
    previews: new Map(),
    writing: null,
  };
  return document;
};

const createSessions = () => {
  const documents = new Map<string, EditingDocument>();
  const connections = new WeakMap<HostEventPublisher, Map<string, Member>>();
  const clean = (document: EditingDocument) => {
    if (!document.members.size && !document.writing && document.savedRevision === document.revision)
      documents.delete(document.key);
  };
  const close = (member: Member) => {
    const document = member.document;
    document.members.delete(member);
    connections.get(member.events)?.delete(member.id);
    cancel(member);
    clean(document);
  };
  const flush = (document: EditingDocument) => {
    if (!document.writing) {
      document.writing = Promise.resolve()
        .then(async () => {
          while (document.savedRevision < document.revision) {
            const value = structuredClone(document.value);
            const revision = document.revision;
            const changes = diffEditingState(document.saved, value);
            if (changes.length)
              await document.execute({
                ...document.save,
                params: {
                  ...document.save.params,
                  changes: changes.map(({ path, value }) => ({ path, value })),
                },
              });
            document.saved = value;
            document.savedRevision = revision;
            publish(document);
          }
        })
        .finally(() => {
          document.writing = null;
          clean(document);
        });
    }
    return document.writing;
  };
  const connection = (events: HostEventPublisher) => {
    const existing = connections.get(events);
    if (existing) return existing;
    const members = new Map<string, Member>();
    connections.set(events, members);
    events.onDisconnect(() => {
      for (const member of members.values()) close(member);
    });
    return members;
  };
  const open = (owner: Owner, input: OpenRequest, execute: EditingDocument["execute"]) => {
    if (!input.save.commandId.startsWith(`${owner.extensionId}.command.`)) throw fail("editing_save_not_owner");
    const key = JSON.stringify([owner.projectId, owner.extensionId, input.key]);
    let document = documents.get(key);
    if (
      document &&
      (document.save.commandId !== input.save.commandId ||
        diffEditingState(document.save.params ?? {}, input.save.params ?? {}).length)
    )
      throw fail("editing_save_mismatch");
    const members = connection(owner.events);
    const member = members.get(input.sessionId);
    if (member && member.document !== document) throw fail("editing_session_duplicate");
    if (!document) {
      document = createDocument(owner, key, input, execute);
      documents.set(key, document);
    }
    if (!member) {
      const joined = { id: input.sessionId, events: owner.events, document };
      members.set(input.sessionId, joined);
      document.members.add(joined);
    }
    return snapshot(document);
  };
  return (owner: Owner) => ({
    async request(input: WebviewEditingSessionParams, execute: EditingDocument["execute"]) {
      if (input.operation === "open") return open(owner, input, execute);
      const member = connection(owner.events).get(input.sessionId);
      if (!member && input.operation === "close") return;
      if (!member) throw fail("editing_session_closed");
      if (member.document.scope !== ownerScope(owner)) throw fail("editing_session_closed");
      const document = member.document;
      if (input.operation === "close") {
        close(member);
        return;
      }
      switch (input.operation) {
        case "preview":
          preview(member, input);
          break;
        case "cancel":
          cancel(member);
          break;
        case "refresh":
          return refresh(document, input);
        case "commit":
          commit(member, input);
          await flush(document);
          break;
        case "save":
          await flush(document);
          break;
      }
      return snapshot(document);
    },
  });
};

const sessions = new WeakMap<WorkbenchCore, ReturnType<typeof createSessions>>();
export const createWorkbenchEditingSessionAdapter = (input: {
  workbench: WorkbenchCore;
  extensionId?: string;
  projectId?: string;
  hostEvents?: HostEventPublisher;
}) => {
  const { workbench, extensionId, projectId, hostEvents } = input;
  if (!extensionId || !projectId || !hostEvents) return;
  let owner = sessions.get(workbench);
  if (!owner) {
    owner = createSessions();
    sessions.set(workbench, owner);
  }
  return owner({ extensionId, projectId, events: hostEvents });
};
