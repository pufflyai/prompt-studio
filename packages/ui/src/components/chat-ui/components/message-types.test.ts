import { describe, expect, test } from "bun:test";
import {
  getAssistantMessageActionTargetId,
  groupMessagesByTurn,
  normalizeChatMessagesForDisplay,
  type SessionMessage,
} from "./message-types";

const uiSourceDir = decodeURIComponent(new URL("../../..", import.meta.url).pathname).replace(/\/$/, "");
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
    const name = file.split("/").at(-1) ?? "";
    return !name.includes(".test.") && !name.includes(".spec.");
  });
};

const relativeUiSourcePath = (file: string) => {
  if (!file.startsWith(`${uiSourceDir}/`)) return file;
  return file.slice(uiSourceDir.length + 1);
};

describe("chat message types", () => {
  test("do not carry agent runtime contracts or node imports", async () => {
    const violations = await Promise.all(
      listUiSourceFiles().map(async (file) => {
        const source = await Bun.file(file).text();
        const relativePath = relativeUiSourcePath(file);
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
