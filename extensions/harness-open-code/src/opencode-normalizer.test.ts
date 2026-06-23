import { describe, expect, test } from "bun:test";
import { normalizeOpencodeMessage } from "./opencode-normalizer";
import type { OpencodeSessionMessage, OpencodeSessionMessagePart } from "./opencode-types";

// --- Helpers ---

const contentMsg = (role: string, parts: OpencodeSessionMessagePart[]): OpencodeSessionMessage => ({
  role,
  content: parts,
});

const partsMsg = (
  parts: OpencodeSessionMessagePart[],
  info?: OpencodeSessionMessage extends infer T ? (T extends { info?: infer I } ? I : never) : never,
): OpencodeSessionMessage => ({
  info,
  parts,
});

describe("normalizeOpencodeMessage", () => {
  describe("part extraction", () => {
    test("extracts parts from content format", () => {
      const msg = contentMsg("user", [{ type: "text", text: "hello" }]);
      const result = normalizeOpencodeMessage(msg, 0);

      expect(result.parts).toEqual([{ type: "text", text: "hello" }]);
    });

    test("extracts parts from parts format", () => {
      const msg = partsMsg([{ type: "text", text: "hello" }]);
      const result = normalizeOpencodeMessage(msg, 0);

      expect(result.parts).toEqual([{ type: "text", text: "hello" }]);
    });

    test("returns no parts when no parts found", () => {
      const msg = partsMsg([]);
      const result = normalizeOpencodeMessage(msg, 0);

      expect(result.parts).toEqual([]);
    });

    test("filters out empty parts", () => {
      const msg = contentMsg("user", [{ type: "text", text: "" }]);
      const result = normalizeOpencodeMessage(msg, 0);

      expect(result.parts).toEqual([]);
    });
  });

  describe("role resolution", () => {
    test("resolves role from content format", () => {
      const result = normalizeOpencodeMessage(contentMsg("user", [{ type: "text", text: "hi" }]), 0);

      expect(result.role).toBe("user");
    });

    test("resolves role from info format", () => {
      const result = normalizeOpencodeMessage(partsMsg([{ type: "text", text: "hi" }], { role: "system" }), 0);

      expect(result.role).toBe("system");
    });

    test("defaults to assistant for unknown role", () => {
      const result = normalizeOpencodeMessage(contentMsg("something_else", [{ type: "text", text: "hi" }]), 0);

      expect(result.role).toBe("assistant");
    });

    test("defaults to assistant when no role present", () => {
      const result = normalizeOpencodeMessage(partsMsg([{ type: "text", text: "hi" }]), 0);

      expect(result.role).toBe("assistant");
    });

    test("resolves tool role", () => {
      const result = normalizeOpencodeMessage(contentMsg("tool", [{ type: "text", text: "hi" }]), 0);

      expect(result.role).toBe("tool");
    });
  });

  describe("text parts", () => {
    test("normalizes text parts", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "text", text: "hello world" }]), 0);

      expect(result.parts).toEqual([{ type: "text", text: "hello world" }]);
    });

    test("filters empty text", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "text", text: "" }]), 0);

      expect(result.parts).toEqual([]);
    });

    test("filters text with missing text field", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "text" }]), 0);

      expect(result.parts).toEqual([]);
    });

    test("filters whitespace-only text", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "text", text: "   " }]), 0);

      expect(result.parts).toEqual([]);
    });
  });

  describe("file parts", () => {
    test("preserves session attachment file ids", () => {
      const result = normalizeOpencodeMessage(
        contentMsg("user", [
          {
            type: "file",
            fileId: "file-notes",
            filename: "notes.txt",
            mime: "text/plain",
            url: "data:text/plain;base64,aGVsbG8=",
          },
        ]),
        0,
      );

      expect(result.parts).toEqual([
        {
          type: "file",
          fileId: "file-notes",
          filename: "notes.txt",
          mediaType: "text/plain",
          url: "data:text/plain;base64,aGVsbG8=",
        },
      ]);
    });
  });

  describe("reasoning parts", () => {
    test("normalizes reasoning parts", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "reasoning", text: "thinking" }]), 0);

      expect(result.parts).toEqual([{ type: "reasoning", text: "thinking" }]);
    });

    test("filters reasoning with missing text", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "reasoning" }]), 0);

      expect(result.parts).toEqual([]);
    });

    test("filters empty reasoning text", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "reasoning", text: "  " }]), 0);

      expect(result.parts).toEqual([]);
    });
  });
});

describe("normalizeOpencodeMessage tool and patch parts", () => {
  describe("tool parts", () => {
    test("normalizes tool part with state", () => {
      const result = normalizeOpencodeMessage(
        contentMsg("assistant", [
          {
            type: "tool",
            tool: "bash",
            callID: "call-1",
            state: { status: "completed", input: "ls", output: "file.txt" },
          },
        ]),
        0,
      );

      expect(result.parts).toEqual([
        {
          type: "tool",
          tool: "bash",
          callId: "call-1",
          actionType: "execute",
          status: "completed",
          state: { status: "completed", input: "ls", output: "file.txt", errorText: undefined, metadata: undefined },
        },
      ]);
    });

    test("defaults tool name to unknown", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "tool" }]), 0);

      expect(result.parts[0]).toMatchObject({ type: "tool", tool: "unknown" });
    });

    test("normalizes tool part without state", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "tool", tool: "read" }]), 0);

      expect(result.parts[0]).toMatchObject({ type: "tool", tool: "read", state: undefined });
    });
  });

  describe("tool classification", () => {
    const cases = [
      { tool: "glob", expected: "read" },
      { tool: "read", expected: "read" },
      { tool: "grep", expected: "read" },
      { tool: "search", expected: "read" },
      { tool: "write", expected: "write" },
      { tool: "edit", expected: "write" },
      { tool: "patch", expected: "write" },
      { tool: "notebook_edit", expected: "write" },
      { tool: "todowrite", expected: "write" },
      { tool: "bash", expected: "execute" },
      { tool: "task", expected: "execute" },
      { tool: "shell", expected: "execute" },
      { tool: "question", expected: "execute" },
      { tool: "web_fetch", expected: "network" },
      { tool: "web_search", expected: "network" },
      { tool: "fetch", expected: "network" },
      { tool: "unknown_tool", expected: "other" },
    ];

    for (const { tool, expected } of cases) {
      test(`classifies ${tool} as ${expected}`, () => {
        const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "tool", tool }]), 0);

        expect(result.parts[0]).toMatchObject({ actionType: expected });
      });
    }

    test("classifies case-insensitively", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "tool", tool: "Bash" }]), 0);

      expect(result.parts[0]).toMatchObject({ actionType: "execute" });
    });

    test("preserves structured question input payload", () => {
      const questionInput = {
        tool: "question",
        questions: [
          {
            id: "language",
            type: "single_choice",
            question: "Which language do you want to use?",
            options: ["JavaScript", "Python", "Go"],
            required: true,
          },
        ],
      };

      const result = normalizeOpencodeMessage(
        contentMsg("assistant", [
          {
            type: "tool",
            tool: "question",
            state: {
              status: "completed",
              input: questionInput,
              output: ["Python"],
            },
          },
        ]),
        0,
      );

      expect(result.parts[0]).toMatchObject({
        type: "tool",
        tool: "question",
        actionType: "execute",
        state: {
          input: questionInput,
          output: ["Python"],
        },
      });
    });

    test("preserves structured todowrite payload for object variant", () => {
      const todos = [
        { content: "Wire API", status: "in_progress", priority: "high" },
        { content: "Run validate", status: "pending", priority: "medium" },
      ];

      const result = normalizeOpencodeMessage(
        contentMsg("assistant", [
          {
            type: "tool",
            tool: "todowrite",
            state: {
              status: "completed",
              input: { todos },
              output: todos,
            },
          },
        ]),
        0,
      );

      expect(result.parts[0]).toMatchObject({
        type: "tool",
        tool: "todowrite",
        actionType: "write",
        state: {
          input: { todos },
          output: todos,
        },
      });
    });

    test("preserves structured todowrite payload for array variant", () => {
      const todos = [{ content: "Ship", status: "pending", priority: "low" }];

      const result = normalizeOpencodeMessage(
        contentMsg("assistant", [
          {
            type: "tool",
            tool: "todowrite",
            state: {
              status: "completed",
              input: todos,
            },
          },
        ]),
        0,
      );

      expect(result.parts[0]).toMatchObject({
        type: "tool",
        tool: "todowrite",
        actionType: "write",
        state: {
          input: todos,
        },
      });
    });
  });

  describe("tool status resolution", () => {
    const statusCases = [
      { input: "completed", expected: "completed" },
      { input: "running", expected: "running" },
      { input: "error", expected: "failed" },
      { input: "failed", expected: "failed" },
      { input: "pending", expected: "pending" },
      { input: undefined, expected: "completed" },
      { input: "something_else", expected: "completed" },
    ];

    for (const { input, expected } of statusCases) {
      test(`resolves status ${input ?? "undefined"} to ${expected}`, () => {
        const result = normalizeOpencodeMessage(
          contentMsg("assistant", [{ type: "tool", tool: "read", state: { status: input } }]),
          0,
        );

        expect(result.parts[0]).toMatchObject({ status: expected });
      });
    }
  });

  describe("step parts", () => {
    test("normalizes step-start", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "step-start", snapshot: "snap-1" }]), 0);

      expect(result.parts).toEqual([{ type: "step-start", snapshot: "snap-1" }]);
    });

    test("normalizes step-finish", () => {
      const result = normalizeOpencodeMessage(
        contentMsg("assistant", [
          { type: "step-finish", reason: "done", snapshot: "snap-2", cost: 0.05, tokens: { total: 100 } },
        ]),
        0,
      );

      expect(result.parts).toEqual([
        { type: "step-finish", reason: "done", snapshot: "snap-2", cost: 0.05, tokens: { total: 100 } },
      ]);
    });
  });

  describe("patch parts", () => {
    test("normalizes patch parts", () => {
      const result = normalizeOpencodeMessage(
        contentMsg("assistant", [{ type: "patch", hash: "abc123", files: ["a.ts"] }]),
        0,
      );

      expect(result.parts).toEqual([{ type: "patch", hash: "abc123", files: ["a.ts"] }]);
    });
  });

  describe("error parts", () => {
    test("normalizes explicit error part with message", () => {
      const result = normalizeOpencodeMessage(
        contentMsg("system", [
          { type: "error", errorType: "permission", message: "Permission denied" } as OpencodeSessionMessagePart,
        ]),
        0,
      );

      expect(result.parts).toEqual([{ type: "error", errorType: "permission", message: "Permission denied" }]);
    });

    test("falls back to other error type for unknown values", () => {
      const result = normalizeOpencodeMessage(
        contentMsg("system", [
          { type: "error", errorType: "unknown_problem", text: "Boom" } as OpencodeSessionMessagePart,
        ]),
        0,
      );

      expect(result.parts).toEqual([{ type: "error", errorType: "other", message: "Boom" }]);
    });

    test("extracts error from info.error when parts are empty", () => {
      const result = normalizeOpencodeMessage(
        partsMsg([], {
          role: "assistant",
          id: "msg-err",
          error: { name: "UnknownError", data: { message: "Error: Was there a typo in the url or port?" } },
        }),
        0,
      );

      expect(result.parts).toEqual([
        { type: "error", errorType: "other", message: "Error: Was there a typo in the url or port?" },
      ]);
    });

    test("extracts error from info.error using name when no data.message", () => {
      const result = normalizeOpencodeMessage(
        partsMsg([], {
          role: "assistant",
          id: "msg-err",
          error: { name: "TimeoutError" },
        }),
        0,
      );

      expect(result.parts).toEqual([{ type: "error", errorType: "timeout", message: "TimeoutError" }]);
    });
  });

  describe("unknown part types", () => {
    test("falls back to text if text field is present", () => {
      const result = normalizeOpencodeMessage(
        contentMsg("assistant", [{ type: "custom_type", text: "some content" }]),
        0,
      );

      expect(result.parts).toEqual([{ type: "text", text: "some content" }]);
    });

    test("filters unknown types without text", () => {
      const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "custom_type" }]), 0);

      expect(result.parts).toEqual([]);
    });
  });
});

describe("normalizeOpencodeMessage metadata", () => {
  describe("id generation", () => {
    test("uses info.id when available", () => {
      const result = normalizeOpencodeMessage(partsMsg([{ type: "text", text: "hi" }], { id: "msg-123" }), 5);

      expect(result.id).toBe("msg-123");
    });

    test("generates id from index when no info.id", () => {
      const result = normalizeOpencodeMessage(contentMsg("user", [{ type: "text", text: "hi" }]), 7);

      expect(result.id).toBe("opencode-msg-7");
    });
  });

  describe("index", () => {
    test("sets the index from parameter", () => {
      const result = normalizeOpencodeMessage(contentMsg("user", [{ type: "text", text: "hi" }]), 42);

      expect(result.index).toBe(42);
    });
  });

  describe("tokens", () => {
    test("extracts tokens from info", () => {
      const result = normalizeOpencodeMessage(
        partsMsg([{ type: "text", text: "hi" }], {
          tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 2 } },
        }),
        0,
      );

      expect(result.tokens).toEqual({ input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 2 } });
    });

    test("returns undefined tokens when no info", () => {
      const result = normalizeOpencodeMessage(contentMsg("user", [{ type: "text", text: "hi" }]), 0);

      expect(result.tokens).toBeUndefined();
    });

    test("returns undefined tokens when info has no tokens", () => {
      const result = normalizeOpencodeMessage(partsMsg([{ type: "text", text: "hi" }], { id: "msg-1" }), 0);

      expect(result.tokens).toBeUndefined();
    });
  });

  describe("createdAt", () => {
    test("extracts createdAt from info time", () => {
      const result = normalizeOpencodeMessage(
        partsMsg([{ type: "text", text: "hi" }], { time: { created: 1_777_777_777_000 } }),
        0,
      );

      expect(result.createdAt).toBe(1_777_777_777_000);
    });
  });

  describe("model and provider", () => {
    test("extracts modelId and providerId from info", () => {
      const result = normalizeOpencodeMessage(
        partsMsg([{ type: "text", text: "hi" }], { modelID: "gpt-4", providerID: "openai" }),
        0,
      );

      expect(result.modelId).toBe("gpt-4");
      expect(result.providerId).toBe("openai");
    });

    test("returns undefined model/provider for content format", () => {
      const result = normalizeOpencodeMessage(contentMsg("user", [{ type: "text", text: "hi" }]), 0);

      expect(result.modelId).toBeUndefined();
      expect(result.providerId).toBeUndefined();
    });
  });

  describe("multiple parts", () => {
    test("normalizes multiple parts in one message", () => {
      const result = normalizeOpencodeMessage(
        contentMsg("assistant", [
          { type: "text", text: "Let me check" },
          { type: "tool", tool: "read", callID: "c1", state: { status: "completed" } },
          { type: "text", text: "Here's what I found" },
        ]),
        0,
      );

      expect(result.parts).toHaveLength(3);
      expect(result.parts[0]).toMatchObject({ type: "text", text: "Let me check" });
      expect(result.parts[1]).toMatchObject({ type: "tool", tool: "read" });
      expect(result.parts[2]).toMatchObject({ type: "text", text: "Here's what I found" });
    });

    test("filters nulls from mixed parts", () => {
      const result = normalizeOpencodeMessage(
        contentMsg("assistant", [{ type: "text", text: "" }, { type: "text", text: "valid" }, { type: "reasoning" }]),
        0,
      );

      expect(result.parts).toEqual([{ type: "text", text: "valid" }]);
    });
  });
});

describe("normalizeOpencodeMessage error parts", () => {
  test("normalizes error parts into conversation messages", () => {
    const result = normalizeOpencodeMessage(contentMsg("assistant", [{ type: "error" }]), 0);

    expect(result.parts).toEqual([{ type: "error", errorType: "other" }]);
  });

  test("appends info.error even when message has other parts", () => {
    const result = normalizeOpencodeMessage(
      partsMsg([{ type: "text", text: "partial response" }], {
        role: "assistant",
        id: "msg-err",
        error: {
          name: "service_unavailable_error",
          data: { message: "Our servers are currently overloaded. Please try again later." },
        },
      }),
      0,
    );

    expect(result.parts).toHaveLength(2);
    expect(result.parts[0]).toMatchObject({ type: "text", text: "partial response" });
    expect(result.parts[1]).toMatchObject({
      type: "error",
      errorType: "other",
      message: "Our servers are currently overloaded. Please try again later.",
    });
  });

  test("does not duplicate error when parts already contain an error part", () => {
    const result = normalizeOpencodeMessage(
      partsMsg([{ type: "error", errorType: "other", message: "Server overloaded" } as OpencodeSessionMessagePart], {
        role: "assistant",
        id: "msg-err",
        error: { name: "service_unavailable_error", data: { message: "Server overloaded" } },
      }),
      0,
    );

    const errorParts = result.parts.filter((p) => p.type === "error");
    expect(errorParts).toHaveLength(1);
  });
});
