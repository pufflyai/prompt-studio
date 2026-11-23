import { expect, test } from "bun:test";
import type { ExtensionSession } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import extension from "../../extension";
import { classifySession, listAnalyses, scanSessions, writeReport } from "./commands";
import type { SessionMessage } from "./signals";
import { rememberReviewerSession } from "./store";

const session = (id: string, overrides: Partial<ExtensionSession> = {}): ExtensionSession => ({
  id,
  title: `Session ${id}`,
  status: "completed",
  archived: false,
  agent: "pstdio.harness-claude-code.harness.claude-code",
  cwd: null,
  lastSelectedModel: "opus",
  workspaceId: null,
  originalSessionId: null,
  createdAt: `2026-11-0${id.length}T10:00:00.000Z`,
  updatedAt: "2026-11-10T10:00:00.000Z",
  lastRequestStarted: null,
  lastRequestEnded: null,
  usage: null,
  ...overrides,
});
const text = (role: "user" | "assistant", value: string): SessionMessage => ({
  id: crypto.randomUUID(),
  role,
  parts: [{ type: "text", text: value }],
});

const setup = (sessions: ExtensionSession[], conversations: Record<string, SessionMessage[]>) => {
  const storage = createMemoryStorage({ indexes: extension.storageIndexes });
  const reads: string[] = [];
  const written = new Map<string, string>();
  const sessionsApi = {
    query: async () => ({ items: sessions as never[], nextCursor: null }),
    get: async (id: string) => (sessions.find((s) => s.id === id) ?? null) as never,
    getConversation: async (id: string) => {
      reads.push(id);
      return { session: { lastExit: null } as never, messages: conversations[id] ?? [] };
    },
  };
  const run = <P extends Record<string, unknown>, R>(command: { run: (...args: never[]) => R }, params: P) =>
    (command.run as (...args: unknown[]) => R)(
      ...makeCommandArgs({
        storage,
        params,
        overrides: {
          extensionId: "pstdio.pstdio-session-insights",
          sessions: sessionsApi,
          extensionFiles: { writeText: async (path: string, value: string) => void written.set(path, value) },
        },
      }),
    );
  return { storage, reads, written, run };
};

const conversations = {
  ok: [text("user", "refine PS-1"), text("assistant", "Refined.")],
  bad: [
    text("user", "get CI green"),
    text("assistant", "Switched the mirror."),
    text("user", "why are you switching mirror? don't do that"),
    text("assistant", "Reverted."),
  ],
};

test("scan records first-pass outcomes and skips synthetic, running and reviewer sessions", async () => {
  const sessions = [
    session("ok"),
    session("bad"),
    session("fake", { agent: "pstdio.extension-lab.fake" }),
    session("live", { status: "in_progress" }),
    session("reviewer"),
  ];
  const { storage, reads, run } = setup(sessions, conversations);
  await rememberReviewerSession({ storage, events: { emit: async () => {} } } as never, "reviewer");

  const result = await run(scanSessions, {});
  expect(result).toMatchObject({ scanned: 2, total: 2, needsReview: 1 });
  expect(reads.sort()).toEqual(["bad", "ok"]);

  const flagged = await run(listAnalyses, { needsReview: true });
  expect(flagged).toEqual([expect.objectContaining({ sessionId: "bad", outcome: "partial", source: "heuristic" })]);

  // Unchanged sessions are not read again.
  reads.length = 0;
  expect(await run(scanSessions, {})).toMatchObject({ scanned: 0, unchanged: 2 });
  expect(reads).toEqual([]);
});

test("an agent verdict survives rescans until the session changes", async () => {
  const sessions = [session("bad")];
  const { run } = setup(sessions, conversations);
  await run(scanSessions, {});
  await run(classifySession, {
    sessionId: "bad",
    outcome: "partial",
    failureMode: "unwanted_action",
    evidence: 'User: "why are you switching mirror?"',
    lesson: "Do not switch mirrors to work around intermittent CI failures.",
    remediationTarget: "AGENTS.md",
  });

  await run(scanSessions, { rescan: true });
  expect(await run(listAnalyses, {})).toEqual([
    expect.objectContaining({ sessionId: "bad", source: "agent", failureMode: "unwanted_action" }),
  ]);

  sessions[0] = { ...sessions[0]!, updatedAt: "2026-11-12T10:00:00.000Z" };
  await run(scanSessions, {});
  expect(await run(listAnalyses, { needsReview: true })).toEqual([
    expect.objectContaining({ sessionId: "bad", source: "heuristic" }),
  ]);
});

test("classify refuses verdicts a report could not use", async () => {
  const { run } = setup([session("bad")], conversations);
  await expect(run(classifySession, { sessionId: "bad", outcome: "failed", evidence: "x" })).rejects.toThrow(
    "needs --failure-mode",
  );
  await expect(
    run(classifySession, { sessionId: "bad", outcome: "failed", failureMode: "misread_intent", evidence: "x" }),
  ).rejects.toThrow("needs --lesson");
  await expect(run(classifySession, { sessionId: "bad", outcome: "done", evidence: "x" })).rejects.toThrow(
    "Unknown outcome",
  );
  await expect(
    run(classifySession, { sessionId: "bad", outcome: "success", failureMode: "lazy", evidence: "x" }),
  ).rejects.toThrow("Unknown failure mode");
});

test("the report groups failures by mode with lessons and fix targets", async () => {
  const { run, written } = setup([session("ok"), session("bad")], conversations);
  await run(scanSessions, {});
  await run(classifySession, {
    sessionId: "bad",
    outcome: "partial",
    failureMode: "unwanted_action",
    evidence: 'User: "why are you switching mirror?"',
    lesson: "Do not switch mirrors to work around intermittent CI failures.",
    remediationTarget: "AGENTS.md",
  });

  const report = await run(writeReport, { agentOnly: true });
  expect(report.summary).toMatchObject({ judged: 2, failureModes: { unwanted_action: 1 } });
  expect(report.markdown).toContain("## Unwanted action — 1 session(s)");
  expect(report.markdown).toContain("- `AGENTS.md` (1)");
  expect(report.markdown).toContain("Do not switch mirrors");
  expect(report.path).toStartWith(".pstdio/extension-storage/pstdio.pstdio-session-insights/reports/");
  expect([...written.values()][0]).toBe(report.markdown);
});
