import type { ScopedQueryClient } from "@pstdio/sdk/extensions";
import { diffEditingState, type WebviewEditingSessionParams } from "pstdio-api-contracts/extension-kernel";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import type { WorkbenchCore } from "../../core";
import { createCommandEditingDocument } from "./command-editing-document";
import {
  assertEditingCommandOwner,
  type CommandEditingMember,
  type CommandEditingOpen,
  type EditingExecutor,
  type EditingOwner,
  editingFailure,
} from "./command-editing-types";

type Document = ReturnType<typeof createCommandEditingDocument>;
interface Entry {
  document: Document;
  member: CommandEditingMember;
  scope: string;
}
const same = (before: object, after: object) => !diffEditingState(before, after).length;
const assertEntryOwner = (entry: Entry, document: Document, workbench: WorkbenchCore) => {
  if (entry.document !== document || entry.member.workbench !== workbench)
    throw editingFailure("editing_session_duplicate");
};

const assertMatching = (before: CommandEditingOpen, after: CommandEditingOpen) => {
  if (
    !same(before.read, after.read) ||
    !same(before.command, after.command) ||
    !same(before.dependsOn, after.dependsOn)
  )
    throw editingFailure("editing_command_mismatch");
};

const createCommandEditingRoot = (queries: ScopedQueryClient) => {
  const documents = new Map<string, { document: Document; open: CommandEditingOpen }>();
  const all = new Set<Document>();
  const connections = new WeakMap<HostEventPublisher, Map<string, Entry>>();
  const retire = (key: string, document: Document) => {
    if (documents.get(key)?.document === document) documents.delete(key);
    for (const member of document.members) connections.get(member.events)?.delete(member.id);
    void document.dispose().then(
      () => all.delete(document),
      () => undefined,
    );
  };
  queries.subscribeRetirement(() => {
    for (const [key, entry] of [...documents]) if (entry.document.retired()) retire(key, entry.document);
  });
  const trim = () => {
    const inactive = [...documents].filter(([, entry]) => !entry.document.protected());
    for (const [key, entry] of inactive.slice(0, Math.max(0, inactive.length - 128))) {
      retire(key, entry.document);
    }
  };
  const close = (entry: Entry) => {
    connections.get(entry.member.events)?.delete(entry.member.id);
    entry.document.close(entry.member);
    trim();
  };
  const connection = (events: HostEventPublisher) => {
    let members = connections.get(events);
    if (members) return members;
    members = new Map();
    connections.set(events, members);
    const owned = members;
    events.onDisconnect(() => {
      for (const entry of owned.values()) close(entry);
    });
    return owned;
  };
  const open = async (
    workbench: WorkbenchCore,
    owner: EditingOwner,
    request: CommandEditingOpen,
    execute: EditingExecutor,
  ) => {
    assertEditingCommandOwner(owner.extensionId, request.read.commandId);
    assertEditingCommandOwner(owner.extensionId, request.command.commandId);
    const key = JSON.stringify([owner.projectId, owner.extensionId, request.key]);
    let existing = documents.get(key);
    if (existing?.document.retired()) {
      retire(key, existing.document);
      existing = undefined;
    }
    if (existing) assertMatching(existing.open, request);
    if (!existing) {
      const document = createCommandEditingDocument({
        queries,
        owner: { projectId: owner.projectId, extensionId: owner.extensionId },
        open: structuredClone(request),
        changed: trim,
        retired: () => retire(key, document),
      });
      existing = { document, open: structuredClone(request) };
      documents.set(key, existing);
      all.add(document);
    }
    const members = connection(owner.events);
    let entry = members.get(request.sessionId);
    if (entry) assertEntryOwner(entry, existing.document, workbench);
    if (!entry) {
      entry = {
        member: { id: request.sessionId, events: owner.events, execute, workbench },
        document: existing.document,
        scope: JSON.stringify([owner.projectId, owner.extensionId]),
      };
      members.set(request.sessionId, entry);
    }
    try {
      const result = await existing.document.join(entry.member);
      trim();
      return result;
    } catch (error) {
      close(entry);
      if (!existing.document.protected()) {
        if (documents.get(key)?.document === existing.document) documents.delete(key);
        all.delete(existing.document);
        await existing.document.dispose();
      }
      throw error;
    }
  };
  const detachCore = (document: Document, workbench: WorkbenchCore, errors: unknown[]) => {
    const members = [...document.members].filter((member) => member.workbench === workbench);
    const pending = document.requiredFor(workbench) || members.length > 0;
    for (const member of members) {
      connections.get(member.events)?.delete(member.id);
      try {
        document.retireMember(member);
      } catch (error) {
        errors.push(error);
      }
    }
    return pending;
  };
  return {
    inspect: () => ({ retained: documents.size, owners: all.size }),
    has: (owner: EditingOwner, id: string) => connections.get(owner.events)?.has(id) ?? false,
    async request(
      workbench: WorkbenchCore,
      owner: EditingOwner,
      request: WebviewEditingSessionParams,
      execute: EditingExecutor,
    ) {
      if (request.operation === "open-command") return open(workbench, owner, request, execute);
      const entry = connections.get(owner.events)?.get(request.sessionId);
      if (!entry && request.operation === "close") return;
      if (
        !entry ||
        entry.member.workbench !== workbench ||
        entry.scope !== JSON.stringify([owner.projectId, owner.extensionId])
      )
        throw editingFailure("editing_session_closed");
      if (request.operation === "close") {
        close(entry);
        return;
      }
      return entry.document.request(entry.member, request);
    },
    updateObservation() {
      for (const document of all) document.updateObservation();
    },
    async flushCommand(workbench: WorkbenchCore, projectId: string | undefined, commandId: string) {
      const pending = [...all].filter(
        (document) => document.matchesCommand(projectId, commandId) && document.requiredFor(workbench),
      );
      await Promise.all(pending.map((document) => document.flush(workbench)));
    },
    async disposeCore(workbench: WorkbenchCore) {
      const errors: unknown[] = [];
      const pending = [...all].filter((document) => detachCore(document, workbench, errors));
      const results = await Promise.allSettled(pending.map((document) => document.flush(workbench)));
      for (const result of results) if (result.status === "rejected") errors.push(result.reason);
      for (const document of pending) if (document.retired() && !document.protected()) all.delete(document);
      if (errors.length) throw new AggregateError(errors, "Command editing could not finish");
    },
  };
};

const roots = new WeakMap<ScopedQueryClient, ReturnType<typeof createCommandEditingRoot>>();
export const inspectCommandEditingSessions = (queries: ScopedQueryClient) => roots.get(queries)?.inspect();
/** The protocol authority has the same runtime/account/project identity as its finite sources. */
export const createCommandEditingSessions = (
  workbench: WorkbenchCore,
  queries: ScopedQueryClient,
  retiring: () => boolean,
) => {
  let root = roots.get(queries);
  if (!root) {
    root = createCommandEditingRoot(queries);
    roots.set(queries, root);
  }
  const owner = root;
  const stopActivation = workbench.activation.store.subscribe(owner.updateObservation);
  let closed = false;
  let disposal: Promise<void> | undefined;
  return {
    has: owner.has,
    flushCommand: (projectId: string | undefined, commandId: string) =>
      owner.flushCommand(workbench, projectId, commandId),
    async request(scope: EditingOwner, request: WebviewEditingSessionParams, execute: EditingExecutor) {
      if ((closed || retiring()) && request.operation === "close") return;
      if (closed || retiring()) throw editingFailure("editing_session_closed");
      return owner.request(workbench, scope, request, execute);
    },
    dispose() {
      if (disposal) return disposal;
      closed = true;
      stopActivation();
      disposal = owner.disposeCore(workbench);
      return disposal;
    },
  };
};
