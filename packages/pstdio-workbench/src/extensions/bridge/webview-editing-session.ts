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
import type { settingsLeaveGuard } from "../../react/settings/settings-leave-guard";

import { editingSequence } from "./editing-sequence";

interface Member {
  id: string;
  events: HostEventPublisher;
  document: EditingDocument;
  unregister?: () => void;
  changed?: () => void;
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
  settings?: ReturnType<typeof settingsLeaveGuard>;
  title?: string;
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
  for (const member of document.members) {
    member.changed?.();
    member.events.emit({
      scope: "editing.session",
      payload: {
        sessionId: member.id,
        snapshot: current,
        ...(accepted?.member === member ? { appliedSequence: accepted.sequence } : {}),
      },
    });
  }
};

const preview = (member: Member, input: Extract<WebviewEditingSessionParams, { changes: unknown }>) => {
  if (!editingSequence(member).preview(input.sequence)) return;
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
  const ownPreview = editingSequence(member).complete(input.sequence);
  const changes = [...(ownPreview ? (document.previews.get(member) ?? []) : []), ...input.changes];
  const value = applyEditingChanges(document.value, changes);
  const previews = new Map(document.previews);
  if (ownPreview) previews.delete(member);
  const rebased = rebaseEditingChanges(value, previews);
  document.value = value;
  document.previews = rebased.drafts;
  if (changes.length) document.revision++;
  publish(document, { member, sequence: input.sequence });
};
const cancel = (member: Member, sequence?: number) => {
  if (!editingSequence(member).cancel(sequence)) return;
  const document = member.document;
  if (!document.previews.has(member)) return;
  const previews = new Map(document.previews);
  previews.delete(member);
  document.previews = rebaseEditingChanges(document.value, previews).drafts;
  publish(document);
};
const refresh = (document: EditingDocument, input: Extract<WebviewEditingSessionParams, { operation: "refresh" }>) => {
  if (input.expectedVersion !== document.version || document.savedRevision !== document.revision) return;
  if (!diffEditingState(document.value, input.value).length && !diffEditingState(document.saved, input.value).length)
    return snapshot(document);
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

export const createLegacyEditingSessions = (retiring: () => boolean) => {
  const documents = new Map<string, EditingDocument>();
  let closed = false;
  const connections = new WeakMap<HostEventPublisher, Map<string, Member>>();
  const clean = (document: EditingDocument) => {
    if (!document.members.size && !document.writing && document.savedRevision === document.revision)
      documents.delete(document.key);
  };
  const close = (member: Member) => {
    const document = member.document;
    document.members.delete(member);
    connections.get(member.events)?.delete(member.id);
    try {
      member.unregister?.();
    } finally {
      cancel(member);
      clean(document);
    }
  };
  const flush = (document: EditingDocument) => {
    if (!document.writing && document.savedRevision === document.revision) return Promise.resolve();
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
          publish(document);
          clean(document);
        });
    }
    publish(document);
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
      const joined: Member = { id: input.sessionId, events: owner.events, document };
      members.set(input.sessionId, joined);
      document.members.add(joined);
      if (owner.settings) {
        const draft = document;
        joined.changed = owner.settings.changed;
        joined.unregister = owner.settings.register({
          title: owner.title ?? "Settings",
          get dirty() {
            return diffEditingState(draft.saved, snapshot(draft).value).length > 0;
          },
          get saving() {
            return draft.writing !== null;
          },
          save: async () => {
            do {
              commit(joined, { operation: "commit", sessionId: joined.id, sequence: 0, changes: [] });
              await flush(draft);
            } while (diffEditingState(draft.saved, snapshot(draft).value).length);
          },
          reset: () => {
            draft.value = structuredClone(draft.saved);
            draft.revision = draft.savedRevision;
            draft.previews.clear();
            publish(draft);
          },
        });
      }
    }
    return snapshot(document);
  };
  const isClosed = () => closed || retiring();
  const assertOpen = () => {
    if (isClosed()) throw fail("editing_session_closed");
  };
  const memberFor = (owner: Owner, id: string) => {
    const member = connections.get(owner.events)?.get(id);
    if (member && member.document.scope !== ownerScope(owner)) throw fail("editing_session_closed");
    return member;
  };
  const applyRequest = async (member: Member, input: WebviewEditingSessionParams) => {
    const document = member.document;
    switch (input.operation) {
      case "preview":
        preview(member, input);
        break;
      case "cancel":
        cancel(member, input.sequence);
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
  };
  const request = async (owner: Owner, input: WebviewEditingSessionParams, execute: EditingDocument["execute"]) => {
    if (isClosed() && input.operation === "close") return;
    assertOpen();
    if (input.operation === "open-command" || input.operation === "execute")
      throw fail("editing_operation_not_supported");
    if (input.operation === "open") return open(owner, input, execute);
    const member = memberFor(owner, input.sessionId);
    if (!member && input.operation === "close") return;
    if (!member) throw fail("editing_session_closed");
    if (input.operation === "close") {
      close(member);
      return;
    }
    return applyRequest(member, input);
  };
  const forOwner = (owner: Owner) => ({
    request: (input: WebviewEditingSessionParams, execute: EditingDocument["execute"]) =>
      request(owner, input, execute),
  });
  return {
    forOwner,
    async dispose() {
      if (closed) return;
      closed = true;
      const errors: unknown[] = [];
      const pending = [...documents.values()];
      for (const document of pending)
        for (const member of [...document.members]) {
          try {
            close(member);
          } catch (error) {
            errors.push(error);
          }
        }
      const results = await Promise.allSettled(pending.map(flush));
      documents.clear();
      for (const result of results) if (result.status === "rejected") errors.push(result.reason);
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, "Structured editing could not finish");
    },
  };
};
