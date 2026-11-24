import { expect, test } from "bun:test";
import type { ChatDraft } from "@pstdio/sdk/extensions";
import { createLocalChatDrafts } from "./chat-local-drafts";
import { createChatSession } from "./chat-session";

const draft: ChatDraft = {
  text: "Keep older work",
  attachments: [{ id: "notes", name: "notes.txt" }],
  values: { harness: { harnessId: "agent", model: "chosen" } },
};
const withStorage = async (run: (records: Map<string, string>) => Promise<void>) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map<string, string>();
  try {
    await run(records);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
};

test.each(["read", "write"])("a failed browser storage %s preserves pending recovery until a durable copy", (failure) =>
  withStorage(async (records) => {
    const pending = "pstdio-workbench:chat-draft-pending:scope";
    records.set(pending, JSON.stringify(draft));
    let unavailable = true;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem(key: string) {
          if (unavailable && failure === "read" && key.includes("chat-draft:")) throw new Error("Storage denied");
          return records.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          if (unavailable && failure === "write" && key.includes("chat-draft:")) throw new Error("Storage full");
          records.set(key, value);
        },
        removeItem: (key: string) => records.delete(key),
      },
    });
    const open = () => createChatSession({ query: async () => ({}), action: async () => undefined });
    const first = open();
    createLocalChatDrafts("scope", () => undefined).restore(first);
    expect(first.getSnapshot().error).toBe(failure === "read" ? "Storage denied" : "Storage full");
    expect(records.get(pending)).toBe(JSON.stringify(draft));
    first.dispose();
    unavailable = false;
    const replacement = open();
    const local = createLocalChatDrafts("scope", () => undefined);
    local.restore(replacement);
    expect(replacement.getSnapshot().draft).toEqual(draft);
    expect(local.contains(draft)).toBe(true);
    expect(records.has(pending)).toBe(false);
    replacement.dispose();
  }));

test.each([false, true])("a recovery receipt requires every recovered body (empty envelope: %s)", (envelope) =>
  withStorage(async (records) => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => records.get(key) ?? null,
        setItem: (key: string, value: string) => records.set(key, value),
      },
    });
    const local = createLocalChatDrafts("scope", () => undefined);
    const nested = { text: "Earlier attachment", attachments: [{ id: "earlier", name: "earlier.txt" }], values: {} };
    const incoming = { ...(envelope ? { text: "", attachments: [], values: {} } : draft), recovered: [nested] };
    local.save(draft);
    expect(local.contains(incoming)).toBe(false);
    local.save({ text: "New typing", attachments: [], values: {}, recovered: [draft, nested] });
    expect(local.contains(incoming)).toBe(true);
  }));

test.each(["missing", "denied"])("%s browser storage cannot acknowledge a volatile recovery copy", (failure) =>
  withStorage(async () => {
    if (failure === "missing") Reflect.deleteProperty(globalThis, "localStorage");
    else
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        get() {
          throw new Error("Storage denied");
        },
      });
    let acknowledged = 0;
    const local = createLocalChatDrafts("scope", () => ({
      draft,
      acknowledge: () => {
        acknowledged++;
      },
    }));
    const session = createChatSession({ query: async () => ({}), action: async () => undefined });
    try {
      local.restore(session);
      expect(acknowledged).toBe(0);
      expect(local.clientId).toBeUndefined();
      expect(session.getSnapshot().error).toBe("Browser draft storage is unavailable.");
      expect(() => local.save(draft)).toThrow("Browser draft storage is unavailable.");
    } finally {
      session.dispose();
    }
  }));

test.each([false, true])("draft restoration preserves distinct pending and legacy work (local copy: %s)", (hasLocal) =>
  withStorage(async (records) => {
    const localKey = "pstdio-workbench:chat-draft:scope";
    const pendingKey = "pstdio-workbench:chat-draft-pending:scope";
    const local = { text: "Current local work", attachments: [], values: { model: "current" } };
    const pending = { text: "Pending typing", attachments: [{ id: "pending", name: "pending.txt" }], values: {} };
    if (hasLocal) records.set(localKey, JSON.stringify(local));
    records.set(pendingKey, JSON.stringify(pending));
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => records.get(key) ?? null,
        setItem: (key: string, value: string) => records.set(key, value),
        removeItem: (key: string) => records.delete(key),
      },
    });
    const receipts: unknown[] = [];
    const drafts = createLocalChatDrafts("scope", () => ({
      draft,
      acknowledge: () => {
        receipts.push(JSON.parse(records.get(localKey)!));
      },
    }));
    const session = createChatSession({ query: async () => ({}), action: async () => undefined });
    try {
      drafts.restore(session);
      const expected = { ...(hasLocal ? local : pending), recovered: hasLocal ? [pending, draft] : [draft] };
      expect(session.getSnapshot().draft).toEqual(expected);
      expect(receipts).toEqual([expected]);
      expect(records.has(pendingKey)).toBe(false);
      expect(drafts.contains(draft)).toBe(true);
      expect(drafts.contains(pending)).toBe(true);
    } finally {
      session.dispose();
    }
  }));

test("a failed merge of existing, pending and legacy drafts leaves every recovery source intact", () =>
  withStorage(async (records) => {
    const localKey = "pstdio-workbench:chat-draft:scope";
    const pendingKey = "pstdio-workbench:chat-draft-pending:scope";
    const local = { text: "Local work", attachments: [], values: {} };
    const pending = { text: "Pending typing", attachments: [], values: {} };
    records.set(localKey, JSON.stringify(local));
    records.set(pendingKey, JSON.stringify(pending));
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => records.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (key === localKey && JSON.parse(value).recovered?.length) throw new Error("Storage full");
          records.set(key, value);
        },
        removeItem: (key: string) => records.delete(key),
      },
    });
    let acknowledged = 0;
    const drafts = createLocalChatDrafts("scope", () => ({
      draft,
      acknowledge: () => {
        acknowledged++;
      },
    }));
    const session = createChatSession({
      query: async () => ({}),
      action: async () => undefined,
      stageDraft: drafts.save,
      saveDraft: async (draft) => drafts.save(draft),
    });
    try {
      drafts.restore(session);
      const restored = session.getSnapshot().draft;
      session.changeDraft({ text: "New typing" });
      await session.flushDraft();
      expect(session.getSnapshot().error).toBe("Storage full");
      expect(acknowledged).toBe(0);
      expect(records.get(localKey)).toBe(JSON.stringify(local));
      expect(records.get(pendingKey)).toBe(JSON.stringify(pending));
      expect(restored).toEqual({ ...local, recovered: [pending, draft] });
    } finally {
      session.dispose();
    }
  }));

test("restored browser controls keep their saved values when host defaults change", () =>
  withStorage(async (records) => {
    records.set("pstdio-workbench:chat-draft:scope", JSON.stringify(draft));
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => records.get(key) ?? null,
        setItem: (key: string, value: string) => records.set(key, value),
      },
    });
    const session = createChatSession({
      initial: { values: draft.values },
      query: async () => ({}),
      action: async () => undefined,
    });
    try {
      createLocalChatDrafts("scope", () => undefined).restore(session);
      session.accept({
        revision: 1,
        snapshot: { values: { harness: { harnessId: "agent", model: "new-default" } } },
      });
      expect(session.getSnapshot().draft.values).toEqual(draft.values);
    } finally {
      session.dispose();
    }
  }));

test("an old browser draft owner cannot overwrite typing saved by its replacement", () =>
  withStorage(async (records) => {
    const localKey = "pstdio-workbench:chat-draft:scope";
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => records.get(key) ?? null,
        setItem: (key: string, value: string) => records.set(key, value),
      },
    });
    const old = createLocalChatDrafts("scope", () => undefined);
    old.save(draft);
    const replacement = createLocalChatDrafts("scope", () => undefined);
    const newer = { ...draft, text: "New typing in the replacement" };
    replacement.save(newer);
    expect(() => old.save({ text: "", attachments: [], values: {} })).toThrow("draft owner was replaced");
    expect(records.get(localKey)).toBe(JSON.stringify(newer));
  }));

test("pending work rewritten by an older client during migration keeps its newer recovery source", () =>
  withStorage(async (records) => {
    const pendingKey = "pstdio-workbench:chat-draft-pending:scope";
    const newer = { ...draft, text: "Newer pending work" };
    records.set(pendingKey, JSON.stringify(draft));
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => records.get(key) ?? null,
        setItem: (key: string, value: string) => {
          records.set(key, value);
          if (key === "pstdio-workbench:chat-draft:scope") records.set(pendingKey, JSON.stringify(newer));
        },
        removeItem: (key: string) => records.delete(key),
      },
    });
    const session = createChatSession({ query: async () => ({}), action: async () => undefined });
    try {
      createLocalChatDrafts("scope", () => undefined).restore(session);
      expect(session.getSnapshot().draft).toEqual(draft);
      expect(records.get(pendingKey)).toBe(JSON.stringify(newer));
    } finally {
      session.dispose();
    }
  }));

test("a failed browser recovery read blocks replacement writes until recovery is read", () =>
  withStorage(async (records) => {
    const localKey = "pstdio-workbench:chat-draft:scope";
    records.set(localKey, JSON.stringify(draft));
    let denied = true;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => {
          if (denied && key === localKey) throw new Error("Storage denied");
          return records.get(key) ?? null;
        },
        setItem: (key: string, value: string) => records.set(key, value),
      },
    });
    const local = createLocalChatDrafts("scope", () => undefined);
    const session = createChatSession({ query: async () => ({}), action: async () => undefined });
    try {
      local.restore(session);
      denied = false;
      expect(() => local.save({ text: "New typing", attachments: [], values: {} })).toThrow("Storage denied");
      expect(records.get(localKey)).toBe(JSON.stringify(draft));
      local.restore(session);
      expect(session.getSnapshot().draft).toEqual(draft);
      local.save(session.getSnapshot().draft);
    } finally {
      await session.dispose();
    }
  }));
