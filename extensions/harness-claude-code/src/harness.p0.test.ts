import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { buildTranscriptPath, createClaudeCodeHarness } from "./harness";

test("finds native user transcripts when HOME is absent", () => {
  const originalHome = process.env.HOME;
  delete process.env.HOME;
  try {
    expect(buildTranscriptPath("session-id", "/workspace/project")).toBe(
      join(homedir(), ".claude", "projects", "-workspace-project", "session-id.jsonl"),
    );
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
  }
});

test.each([
  ["C:\\Users\\Developer\\My Project", "C--Users-Developer-My-Project"],
  ["C:/Users/Developer/My Project", "C--Users-Developer-My-Project"],
  ["\\\\server\\share\\project.name", "--server-share-project-name"],
])("matches Claude transcript encoding for %s", (cwd, directory) => {
  expect(buildTranscriptPath("session-id", cwd)).toBe(
    join(homedir(), ".claude", "projects", directory, "session-id.jsonl"),
  );
});

const ctx: HarnessContext = {
  extensionId: "pstdio.harness-claude-code",
  name: "harness-claude-code",
  connections: {
    request: async () => {
      throw new Error("No connections are configured in this test");
    },
    stream: async function* () {
      yield { type: "end" } as const;
    },
  },
  process: {
    run: async () => ({ exitCode: 0, stdout: "2.1.295 (Claude Code)", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
};

const buildTranscript = (entries: unknown[]) => entries.map((entry) => JSON.stringify(entry)).join("\n");

test("fork remaps native session identities while keeping the original transcript", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "claude-fork-")));
  const originalConfig = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = join(root, "config");
  const directory = join(process.env.CLAUDE_CONFIG_DIR, "projects", root.replace(/[^a-zA-Z0-9]/g, "-"));
  mkdirSync(directory, { recursive: true });
  const sourceId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const answerId = crypto.randomUUID();
  const continuationId = crypto.randomUUID();
  const transcript = buildTranscript([
    { type: "user", uuid: userId, parentUuid: null, sessionId: sourceId, message: { role: "user", content: "Hello" } },
    {
      type: "assistant",
      uuid: answerId,
      parentUuid: userId,
      sessionId: sourceId,
      message: { role: "assistant", content: [{ type: "text", text: "An answer" }] },
    },
    {
      type: "assistant",
      uuid: continuationId,
      parentUuid: answerId,
      sessionId: sourceId,
      message: { role: "assistant", content: [{ type: "text", text: " continued" }] },
    },
    {
      type: "user",
      uuid: crypto.randomUUID(),
      parentUuid: continuationId,
      sessionId: sourceId,
      message: { role: "user", content: "Later question" },
    },
  ]);
  const path = join(directory, `${sourceId}.jsonl`);
  writeFileSync(path, transcript);
  try {
    const harness = createClaudeCodeHarness();
    const fork = await harness.fork!(ctx, {
      sessionId: "host",
      agentSessionId: sourceId,
      cwd: root,
      messageId: `${answerId}-0`,
    });
    expect(fork.agentSessionId).not.toBe(sourceId);
    expect(readFileSync(path, "utf8")).toBe(transcript);
    const copied = readFileSync(join(directory, `${fork.agentSessionId}.jsonl`), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const messages = copied.filter((entry) => entry.type === "user" || entry.type === "assistant");
    expect(messages.map((entry) => entry.sessionId)).toEqual([
      fork.agentSessionId,
      fork.agentSessionId,
      fork.agentSessionId,
    ]);
    expect(messages[0].uuid).not.toBe(userId);
    expect(messages[1].parentUuid).toBe(messages[0].uuid);
    expect(messages.map((entry) => entry.message)).toEqual(
      JSON.parse(`[${transcript.replaceAll("\n", ",")}]`)
        .slice(0, 3)
        .map((entry: { message: unknown }) => entry.message),
    );
    const history = await harness.getMessages!(ctx, { agentSessionId: fork.agentSessionId, cwd: root });
    expect(history).toHaveLength(2);
    expect(history[1].parts).toEqual([{ type: "text", text: "An answer continued" }]);
  } finally {
    if (originalConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = originalConfig;
    rmSync(root, { recursive: true, force: true });
  }
});

describe("claude-code harness getMessages", () => {
  test("keeps the latest entry for duplicate UUIDs", async () => {
    const transcript = buildTranscript([
      {
        type: "user",
        uuid: "user-1",
        message: { role: "user", content: "hello" },
      },
      {
        type: "assistant",
        uuid: "assistant-1",
        message: { role: "assistant", content: [{ type: "text", text: "draft reply" }] },
      },
      {
        type: "assistant",
        uuid: "assistant-1",
        message: { role: "assistant", content: [{ type: "text", text: "final reply" }] },
      },
    ]);

    const harness = createClaudeCodeHarness({ readTranscript: async () => transcript });

    const messages = await harness.getMessages!(ctx, { agentSessionId: "session-1" });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
    expect((messages[1].parts[0] as { type: string; text: string }).text).toBe("final reply");
  });

  test("normalizes transcript tool_result entries without creating user tool messages", async () => {
    const transcript = buildTranscript([
      {
        type: "assistant",
        uuid: "assistant-tool-start",
        message: {
          role: "assistant",
          content: [{ type: "tool_use", id: "call-1", name: "Read", input: { file: "README.md" } }],
        },
      },
      {
        type: "user",
        uuid: "user-tool-result",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "call-1", content: "file contents", is_error: false }],
        },
      },
      {
        type: "assistant",
        uuid: "assistant-text",
        message: { role: "assistant", content: [{ type: "text", text: "done" }] },
      },
    ]);

    const harness = createClaudeCodeHarness({ readTranscript: async () => transcript });

    const messages = await harness.getMessages!(ctx, { agentSessionId: "session-1" });

    const userToolMessages = messages.filter(
      (message) => message.role === "user" && message.parts.some((part) => part.type === "tool"),
    );
    expect(userToolMessages).toHaveLength(0);

    const toolMessage = messages.find((message) => message.parts.some((part) => part.type === "tool"));
    expect(toolMessage).toBeDefined();
    expect(toolMessage?.role).toBe("assistant");

    const toolPart = toolMessage?.parts[0] as { type: string; status?: string; callId?: string };

    expect(toolPart.type).toBe("tool");
    expect(toolPart.callId).toBe("call-1");
    expect(toolPart.status).toBe("completed");
  });
});

describe("claude-code harness detection", () => {
  test("declares discrete run params", () => {
    const harness = createClaudeCodeHarness();

    expect(harness.params).toMatchObject({
      thinking: {
        type: "select",
        defaultValue: "high",
        options: [
          { label: "Low", value: "low", icon: "level-low" },
          { label: "Medium", value: "medium", icon: "level-mid" },
          { label: "High", value: "high", icon: "level-high" },
          { label: "XHigh", value: "xhigh", icon: "level-xhigh" },
          { label: "Max", value: "max", icon: "flame" },
        ],
      },
    });
    expect(harness.params).not.toHaveProperty("permission-mode");
  });

  test("reports availability with the CLI version", async () => {
    const harness = createClaudeCodeHarness();
    expect(await harness.detect!(ctx)).toMatchObject({ available: true, version: "2.1.295 (Claude Code)" });
  });

  test("lists no models when the CLI is missing", async () => {
    const harness = createClaudeCodeHarness({ detect: async () => ({ available: false }) });
    expect(await harness.listModels!(ctx)).toEqual([]);
  });

  test("lists discovered models when the CLI is present and caches the catalog", async () => {
    let discoveries = 0;
    const harness = createClaudeCodeHarness({
      listModels: async () => {
        discoveries += 1;
        return [{ id: "sonnet-live" }];
      },
    });
    expect((await harness.listModels!(ctx)).map((model) => model.id)).toEqual(["sonnet-live"]);
    expect((await harness.listModels!(ctx)).map((model) => model.id)).toEqual(["sonnet-live"]);
    expect(discoveries).toBe(1);
  });
});

test("account changes refresh Claude's model catalog immediately", async () => {
  let discoveries = 0;
  const harness = createClaudeCodeHarness({
    detect: async () => ({ available: true }),
    listModels: async () => [{ id: String(++discoveries), name: "Model" }],
  });
  const accountCtx = {
    ...ctx,
    process: {
      ...ctx.process,
      run: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({ loggedIn: true, authMethod: "claude.ai" }),
        stderr: "",
      }),
    },
  };
  expect((await harness.listModels!(accountCtx))[0]?.id).toBe("1");
  await harness.authenticate!(
    accountCtx,
    { action: "logout" },
    { signal: new AbortController().signal, request: async () => "", emit: async () => {} },
  );
  expect((await harness.listModels!(accountCtx))[0]?.id).toBe("2");
});
