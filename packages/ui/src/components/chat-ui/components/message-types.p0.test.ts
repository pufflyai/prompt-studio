import { describe, expect, test } from "bun:test";
import { basename, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAssistantMessageActionTargetId,
  groupMessagesByTurn,
  normalizeChatMessagesForDisplay,
  type SessionMessage,
} from "./message-types";

const uiSourceDir = fileURLToPath(new URL("../../..", import.meta.url));
const forbiddenRuntimeTerms = [
  // This file is excluded from the self-scan by the test/spec filename filter.
  "AgentId",
  "AgentService",
  "AgentRegistry",
  "SpawnedProcess",
];
const forbiddenNodeImportPatterns = [/from\s+["']node:/, /import\s+["']node:/, /import\s*\(\s*["']node:/];

const listUiSourceFiles = () => {
  const glob = new Bun.Glob("**/*.{ts,tsx}");

  return [...glob.scanSync({ cwd: uiSourceDir, absolute: true })].filter((file) => {
    const name = basename(file);
    return !name.includes(".test.") && !name.includes(".spec.");
  });
};

describe("chat message types", () => {
  test("live and saved history keeps replies, tools and errors through system status updates", () => {
    const person: SessionMessage = { id: "person", role: "user", parts: [{ type: "text", text: "Check the files." }] };
    const reply: SessionMessage = { id: "reply", role: "assistant", parts: [{ type: "text", text: "Files checked." }] };
    const tool: SessionMessage = {
      id: "tool",
      role: "assistant",
      parts: [{ type: "tool", tool: "Bash", status: "completed" }],
    };
    const failure: SessionMessage = {
      id: "failure",
      role: "system",
      parts: [{ type: "error", errorType: "other", message: "Could not read file." }],
    };
    const status: SessionMessage = {
      id: "status",
      role: "system",
      parts: [
        { type: "text", text: "Native context compaction completed." },
        { type: "token_usage", inputTokens: 10, outputTokens: 5 },
      ],
    };
    const input: SessionMessage[] = [
      person,
      tool,
      reply,
      { id: "saved-notice", role: "system", parts: [{ type: "text", text: "Background task finished." }] },
      status,
      failure,
    ];
    const shown = normalizeChatMessagesForDisplay(input);
    expect(shown).toEqual([person, { ...reply, parts: [...tool.parts, ...reply.parts] }, failure]);
    expect(input[4]).toBe(status);
    expect(status.parts).toHaveLength(2);
  });

  test("display normalization preserves messages that already contain visible parts", () => {
    const completed: SessionMessage = { id: "completed", role: "assistant", parts: [{ type: "text", text: "Done" }] };
    const streaming: SessionMessage = { id: "streaming", role: "assistant", parts: [{ type: "text", text: "First" }] };
    const before = normalizeChatMessagesForDisplay([completed, streaming], { streaming: true });
    const updated = { ...streaming, parts: [{ type: "text" as const, text: "Second" }] };
    const after = normalizeChatMessagesForDisplay([completed, updated], { streaming: true });
    expect(before[0]).toBe(completed);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(updated);
  });

  test("saved tool output survives a filtered lifecycle notice before the next turn or at the end", () => {
    const reply: SessionMessage = {
      id: "reply",
      role: "assistant",
      parts: [{ type: "text", text: "Starting checks." }],
    };
    const completed: SessionMessage = {
      id: "completed",
      role: "tool",
      parts: [{ type: "tool", tool: "run", state: { status: "completed", output: "Checks passed." } }],
    };
    const running: SessionMessage = {
      id: "running",
      role: "tool",
      parts: [{ type: "tool", tool: "run", status: "running" }],
    };
    const notice: SessionMessage = {
      id: "notice",
      role: "system",
      parts: [{ type: "text", text: "Background task finished." }],
    };
    const next: SessionMessage = { id: "next", role: "user", parts: [{ type: "text", text: "Continue." }] };
    const input = [reply, completed, running, notice];
    const shown = [reply, { ...completed, role: "assistant" }];

    expect(normalizeChatMessagesForDisplay(input)).toEqual(shown);
    expect(normalizeChatMessagesForDisplay([...input, next])).toEqual([...shown, next]);
    expect(getAssistantMessageActionTargetId(normalizeChatMessagesForDisplay(input))).toBe("reply");
    expect(
      getAssistantMessageActionTargetId(normalizeChatMessagesForDisplay(input, { streaming: true }), true),
    ).toBeNull();
  });

  test("do not carry agent runtime contracts or node imports", async () => {
    const violations = await Promise.all(
      listUiSourceFiles().map(async (file) => {
        const source = await Bun.file(file).text();
        const relativePath = relative(uiSourceDir, file);
        const runtimeViolations = forbiddenRuntimeTerms
          .filter((term) => source.includes(term))
          .map((term) => `${relativePath}: ${term}`);
        const nodeImportViolations = forbiddenNodeImportPatterns
          .filter((pattern) => pattern.test(source))
          .map(() => `${relativePath}: node:* import`);

        return [...runtimeViolations, ...nodeImportViolations];
      }),
    );

    expect(violations.flat()).toEqual([]);
  });

  test("normalizes activity-only messages into the next assistant response", () => {
    const messages: SessionMessage[] = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Inspect the repo" }] },
      { id: "activity-1", role: "assistant", parts: [{ type: "reasoning", text: "I need to read files." }] },
      {
        id: "activity-2",
        role: "tool",
        parts: [{ type: "tool", tool: "read", state: { status: "completed", output: "file contents" } }],
      },
      { id: "answer-1", role: "assistant", parts: [{ type: "text", text: "I found the issue." }] },
    ];

    const normalized = normalizeChatMessagesForDisplay(messages);
    const { groups } = groupMessagesByTurn(normalized);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.responses).toHaveLength(1);
    expect(groups[0]?.responses[0]?.id).toBe("answer-1");
    expect(groups[0]?.responses[0]?.parts.map((part) => part.type)).toEqual(["reasoning", "tool", "text"]);
  });

  test("drops empty and non-renderable display parts", () => {
    const normalized = normalizeChatMessagesForDisplay([
      {
        id: "blank",
        role: "assistant",
        parts: [
          { type: "text", text: "   " },
          { type: "reasoning", text: "" },
          { type: "token_usage", inputTokens: 10, outputTokens: 5 },
          { type: "step-start" },
          { type: "patch", hash: "abc" },
          { type: "loading" },
        ],
      },
      { id: "answer", role: "assistant", parts: [{ type: "text", text: "Visible" }] },
    ]);

    expect(normalized).toEqual([{ id: "answer", role: "assistant", parts: [{ type: "text", text: "Visible" }] }]);
  });

  test("keeps trailing meaningful activity visible while streaming", () => {
    const normalized = normalizeChatMessagesForDisplay(
      [
        { id: "user-1", role: "user", parts: [{ type: "text", text: "Run tests" }] },
        {
          id: "activity",
          role: "assistant",
          parts: [{ type: "tool", tool: "bash", state: { status: "running", input: { command: "bun test" } } }],
        },
      ],
      { streaming: true },
    );

    expect(normalized.map((message) => message.id)).toEqual(["user-1", "activity"]);
  });

  test("keeps tool calls with the preceding response after the user steers", () => {
    const beforeSteering: SessionMessage[] = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "Run the checks" }] },
      { id: "commentary", role: "assistant", parts: [{ type: "text", text: "I will run the tests." }] },
      {
        id: "tool-1",
        role: "assistant",
        parts: [{ type: "tool", tool: "bash", callId: "run-tests", state: { status: "completed" } }],
      },
      {
        id: "tool-2",
        role: "assistant",
        parts: [{ type: "tool", tool: "read", callId: "read-results", state: { status: "running" } }],
      },
    ];
    const steered: SessionMessage[] = [
      ...beforeSteering,
      { id: "steer", role: "user", parts: [{ type: "text", text: "Run the chat tests first." }] },
      { id: "answer", role: "assistant", parts: [{ type: "text", text: "I ran the chat tests first." }] },
    ];
    const activity = normalizeChatMessagesForDisplay(beforeSteering, { streaming: true }).at(-1);
    for (const streaming of [true, false]) {
      const { groups } = groupMessagesByTurn(normalizeChatMessagesForDisplay(steered, { streaming }));
      const preserved = streaming ? activity : { ...activity!, parts: [beforeSteering[2]!.parts[0]!] };
      expect(groups[0]?.responses).toEqual([beforeSteering[1], preserved]);
      expect(groups[1]?.responses).toEqual([steered.at(-1)]);
    }
  });

  test("targets message actions at the final assistant response in a completed turn", () => {
    const normalized = normalizeChatMessagesForDisplay(
      [
        { id: "user-1", role: "user", parts: [{ type: "text", text: "Make the change" }] },
        { id: "commentary", role: "assistant", parts: [{ type: "text", text: "I will inspect it." }] },
        { id: "tool", role: "assistant", parts: [{ type: "tool", tool: "read", status: "completed" }] },
        { id: "final", role: "assistant", parts: [{ type: "text", text: "The change is complete." }] },
        { id: "user-2", role: "user", parts: [{ type: "text", text: "Thanks" }] },
      ],
      { streaming: true },
    );
    const { groups } = groupMessagesByTurn(normalized);

    expect(getAssistantMessageActionTargetId(groups[0]?.responses ?? [])).toBe("final");
  });

  test("does not target message actions when a tool follows the last assistant response", () => {
    const normalized = normalizeChatMessagesForDisplay(
      [
        { id: "user-1", role: "user", parts: [{ type: "text", text: "Make the change" }] },
        { id: "commentary-1", role: "assistant", parts: [{ type: "text", text: "First update." }] },
        { id: "commentary-2", role: "assistant", parts: [{ type: "text", text: "Second update." }] },
        { id: "tool-1", role: "assistant", parts: [{ type: "tool", tool: "read", status: "completed" }] },
        { id: "tool-2", role: "assistant", parts: [{ type: "tool", tool: "grep", status: "completed" }] },
        { id: "commentary-3", role: "assistant", parts: [{ type: "text", text: "Third update." }] },
        { id: "tool-3", role: "assistant", parts: [{ type: "tool", tool: "shell", status: "running" }] },
      ],
      { streaming: true },
    );
    const { groups } = groupMessagesByTurn(normalized);

    expect(getAssistantMessageActionTargetId(groups[0]?.responses ?? [])).toBeNull();
  });
});
