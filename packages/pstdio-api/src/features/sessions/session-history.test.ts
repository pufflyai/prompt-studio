import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "pstdio-api-contracts";
import { getSessionHistory, loadSessionHistory } from "./session-history";
import { createSessionStore } from "./session-store";

test("a reader waiting on an obsolete initializer follows the new conversation owner", async () => {
  const store = createSessionStore();
  const first = Promise.withResolvers<SessionMessage[]>();
  store.create(
    "s",
    () => {},
    async () => ({ messages: await first.promise }),
  );
  const deps = { sessionService: { store } } as Parameters<typeof getSessionHistory>[1];
  const reading = getSessionHistory("s", deps);
  const next = store.create("s", () => {});
  const messages: SessionMessage[] = [{ id: "new", role: "user", parts: [{ type: "text", text: "next" }] }];
  (await next.conversationReady).push({ op: "replace", path: "/messages", value: messages });
  first.resolve([]);
  expect((await reading).messages).toEqual(messages);
});

test("an unavailable native transcript and no saved checkpoint cannot become a successful empty history", async () => {
  const deps = {
    sessionService: { get: async () => ({ id: "s", agent: "agent", agent_session_id: "thread" }) },
    harnessRegistry: {
      get: async () => ({
        supportsHistory: true,
        getMessages: async () => {
          throw new Error("unavailable");
        },
      }),
    },
  } as never;
  await expect(loadSessionHistory("s", deps)).rejects.toThrow("history");
  expect((await loadSessionHistory("s", deps, [])).messages).toEqual([]);
});

test("saved conversation history survives removal of its workspace worktree", async () => {
  const root = await mkdtemp(join(tmpdir(), "removed-workspace-history-"));
  const path = join(root, "checkpoint.json");
  const messages: SessionMessage[] = [
    { id: "saved", role: "user", parts: [{ type: "text", text: "Keep this conversation" }] },
  ];
  await Bun.write(path, JSON.stringify(messages));
  let nativeReads = 0;
  const deps = {
    sessionService: {
      get: async () => ({
        id: "s",
        agent: "agent",
        agent_session_id: "thread",
        session_file_id: "checkpoint",
        cwd: "/removed/worktree",
      }),
    },
    fileService: { get: async () => ({ storage_path: path }) },
    workspaceSessionService: {
      getWorkspaceBySessionId: async () => ({
        id: "workspace",
        provider_id: "pstdio.worktree",
        execution_kind: "local",
        root_path: null,
      }),
    },
    harnessRegistry: {
      get: async () => ({
        supportsHistory: true,
        getMessages: async () => {
          nativeReads++;
          return [];
        },
      }),
    },
  } as never;
  try {
    expect(await loadSessionHistory("s", deps)).toEqual({
      messages,
      historyIssue: { code: "native_unavailable", category: "native_unavailable" },
    });
    expect(nativeReads).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
