import type { ExtensionSessionQuery } from "pstdio-api-contracts/extension-kernel";
import { unwrapCommandOutcome } from "../../src/extensions/command-outcome";
import { createMemoryStorage } from "../../src/testing/memory-storage";
import type { CurrentApi, FileRoot, Inputs, ProposalApi, RevisedApi } from "./contracts";
import { attachFile, createCommandStream, iterateSessions, rejectedCommand, saveRecord } from "./helpers";
import { createSupport, failure, rejection, track } from "./support";

export const createFixture = async () => {
  const support = createSupport();
  const { record, calls } = support;
  const raw = createMemoryStorage({ kv: { "ticket-1": { title: "Original" } } });
  const storage = {
    ...raw,
    records: track("records", raw.records, calls),
    assets: track("assets", raw.assets, calls),
    collection: <TItem>(name: string) => {
      const collection = raw.collection<TItem>(name);
      return { ...collection, attachments: (id: string) => track("attachments", collection.attachments(id), calls) };
    },
  };
  const query = async (input: ExtensionSessionQuery = {}) => {
    record("sessions.query");
    const matching = support.sessions.filter(
      (session) =>
        (!input.workspaceId || session.workspace_id === input.workspaceId) &&
        (!input.status || input.status.includes(session.status)),
    );
    const offset = Number(input.cursor ?? 0);
    const limit = input.limit ?? 50;
    return {
      items: matching.slice(offset, offset + limit),
      nextCursor: offset + limit < matching.length ? String(offset + limit) : null,
    };
  };
  const links: unknown[] = [];
  const settings = new Map<string, unknown>([["editor.compact", true]]);
  const deletedWorkspaces = new Set<string>();
  // Mirrors the host's canonicalResource: host kinds belong to pstdio, the ticket kind has one declared owner.
  const owned = <T extends { type: string; extensionId?: string }>(ref: T) => ({
    ...ref,
    extensionId: ref.extensionId ?? (ref.type === "session" ? "pstdio" : "planner"),
  });
  const resources: CurrentApi["resources"] = {
    addAnchors: async (source, targets) => {
      record("resources.addAnchors");
      links.push({ source: owned(source), targets: targets.map(owned) });
    },
  };
  const deleteSetting = async (key: string) => {
    record("settings.delete");
    settings.delete(key);
  };
  const deleteWorkspace = async (id: string) => {
    record("workspaces.delete");
    deletedWorkspaces.add(id);
  };
  const current: CurrentApi = {
    notify: { resolve: support.legacyResolve },
    packageFiles: support.roots.package,
    extensionFiles: support.roots.local,
    workspaceFiles: support.roots.current,
    artifacts: { mount: support.shared },
    storage,
    sessions: {
      query,
      addAnchors: async (id, targets) => resources.addAnchors({ type: "session", id, extensionId: "pstdio" }, targets),
    },
    resources,
    settings: { delete: deleteSetting },
    workspaces: { delete: deleteWorkspace },
    views: {
      update: async (_board, id, input) => {
        record("views.update");
        return {
          id,
          boardId: "board-1",
          title: input.title ?? "Review",
          settings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: [] },
          filter: input.filter ?? { conjunction: "and", rules: [] },
          sorts: input.sorts ?? [],
          builtIn: false,
        };
      },
    },
    browser: {
      execute: async () => ({ outcome: rejection }),
      saveTicket: async () => unwrapCommandOutcome({ outcome: rejection }),
      call: async (_capability, input) => deleteSetting(input.key),
      resolve: support.browserResolve,
    },
    http: {
      async *stream() {
        record("commands.stream");
        yield { type: "data", data: "first" };
        yield { type: "data", data: "second" };
        yield {
          type: "end",
          response: {
            commandId: "report",
            extensionId: "example",
            outcome: { ok: true, status: "success", value: "finished" },
          },
        };
      },
    },
  };
  const open: ProposalApi["files"]["open"] = async (input: FileRoot) => {
    if (input.root === "workspace") return support.roots[input.target];
    if (input.root === "shared") return support.shared(input.mount);
    return support.roots[input.root];
  };
  const proposal: ProposalApi = {
    ...current,
    notify: {
      transition: async ({ selector, status }) => {
        if ("id" in selector && "dedupeKey" in selector) throw failure("ambiguous_selector");
        const notifications =
          selector.by === "id"
            ? await support.legacyResolve({ id: selector.id, status })
            : await support.setStatusByKey(selector.dedupeKey, status);
        return { notifications };
      },
    },
    files: { open },
    browser: {
      execute: async () => rejection,
      saveTicket: () => rejectedCommand(rejection),
      settings: { delete: deleteSetting },
    },
    commands: {
      stream: () => {
        record("commands.stream");
        return createCommandStream();
      },
    },
  };
  const revised: RevisedApi = {
    ...proposal,
    notify: { setStatus: support.setStatus, setStatusByKey: support.setStatusByKey },
    files: {
      package: support.roots.package,
      local: support.roots.local,
      currentWorkspace: support.roots.current,
      defaultWorkspace: support.roots.default,
      shared: support.shared,
    },
    storage: {
      ...storage,
      records: {
        ...storage.records,
        save: (snapshot, value, options) => saveRecord(storage.records, snapshot, value, options),
      },
      attachments: { add: (parent, file, options) => attachFile(storage, parent, file, options) },
    },
    sessions: { query, iterate: (filter) => iterateSessions(query, filter) },
    browser: { ...proposal.browser, execute: async () => rejection },
  };
  const inputs: Inputs = {
    notificationId: "review-1",
    dedupeKey: "review",
    workspaceId: "workspace-1",
    sessionId: "session-0",
    ticketId: "ticket-1",
    ticket: await storage.records.read(storage.records.id("ticket-1")),
    title: "Launch Friday",
    file: new File(["report bytes"], "report.txt", { type: "text/plain" }),
    saveId: "save-ticket",
    uploadId: "attach-report",
  };
  calls.length = 0;
  return { apis: { current, proposal, revised }, inputs, storage, links, settings, deletedWorkspaces, ...support };
};
