import { describe, expect, it } from "bun:test";
import { z } from "zod";
import type { SessionMessage, SessionMessagePart } from "../types";
import { sessionMessagePartSchema, sessionMessageSchema } from "./schemas";

describe("sessionMessagePartSchema", () => {
  it("accepts a text part", () => {
    const part: SessionMessagePart = { type: "text", text: "hello" };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts a reasoning part", () => {
    const part: SessionMessagePart = { type: "reasoning", text: "thinking..." };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts a tool part with minimal fields", () => {
    const part: SessionMessagePart = { type: "tool", tool: "Read" };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts a tool part with all optional fields", () => {
    const part: SessionMessagePart = {
      type: "tool",
      tool: "Bash",
      callId: "call_123",
      actionType: "execute",
      status: "completed",
      state: {
        status: "done",
        input: { command: "ls" },
        output: "file.ts",
        errorText: undefined,
        metadata: { duration: 100 },
      },
    };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts a step-start part", () => {
    const part: SessionMessagePart = { type: "step-start", snapshot: "abc" };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts a step-finish part", () => {
    const part: SessionMessagePart = {
      type: "step-finish",
      reason: "done",
      snapshot: "xyz",
      cost: 0.01,
      tokens: { input: 100, output: 50 },
    };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts a patch part", () => {
    const part: SessionMessagePart = { type: "patch", hash: "abc123", files: ["a.ts"] };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts a file part", () => {
    const part: SessionMessagePart = {
      type: "file",
      url: "https://example.com/img.png",
      mediaType: "image/png",
      filename: "img.png",
    };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts a loading part", () => {
    const part: SessionMessagePart = { type: "loading" };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts an error part", () => {
    const part: SessionMessagePart = { type: "error", errorType: "timeout" };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts an error part with message", () => {
    const part: SessionMessagePart = { type: "error", errorType: "permission", message: "Permission denied" };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("accepts a token_usage part", () => {
    const part: SessionMessagePart = {
      type: "token_usage",
      inputTokens: 500,
      outputTokens: 200,
      cacheReadTokens: 100,
      cacheWriteTokens: 50,
    };
    const result = z.safeParse(sessionMessagePartSchema, part);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown part type", () => {
    const result = z.safeParse(sessionMessagePartSchema, { type: "banana", foo: "bar" });
    expect(result.success).toBe(false);
  });

  it("rejects a text part missing text field", () => {
    const result = z.safeParse(sessionMessagePartSchema, { type: "text" });
    expect(result.success).toBe(false);
  });
});

describe("sessionMessageSchema", () => {
  const validMessage: SessionMessage = {
    id: "msg_001",
    role: "assistant",
    parts: [{ type: "text", text: "Hello!" }],
  };

  it("accepts a valid message with required fields only", () => {
    const result = z.safeParse(sessionMessageSchema, validMessage);
    expect(result.success).toBe(true);
  });

  it("accepts a message with all optional fields", () => {
    const message: SessionMessage = {
      id: "msg_002",
      role: "user",
      parts: [{ type: "text", text: "Hi" }],
      index: 0,
      createdAt: 1700000000,
      modelId: "claude-opus-4-6",
      providerId: "anthropic",
      tokens: {
        input: 100,
        output: 200,
        reasoning: 50,
        cache: { read: 10, write: 5 },
      },
    };

    const result = z.safeParse(sessionMessageSchema, message);
    expect(result.success).toBe(true);
  });

  it("accepts all valid roles", () => {
    for (const role of ["user", "assistant", "tool", "system", "developer"]) {
      const result = z.safeParse(sessionMessageSchema, { ...validMessage, role });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid role", () => {
    const result = z.safeParse(sessionMessageSchema, { ...validMessage, role: "admin" });
    expect(result.success).toBe(false);
  });

  it("rejects a message missing id", () => {
    const { id: _, ...noId } = validMessage;
    const result = z.safeParse(sessionMessageSchema, noId);
    expect(result.success).toBe(false);
  });

  it("rejects a message missing parts", () => {
    const { parts: _, ...noParts } = validMessage;
    const result = z.safeParse(sessionMessageSchema, noParts);
    expect(result.success).toBe(false);
  });

  it("rejects a message with invalid parts", () => {
    const result = z.safeParse(sessionMessageSchema, {
      ...validMessage,
      parts: [{ type: "banana" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty object", () => {
    const result = z.safeParse(sessionMessageSchema, {});
    expect(result.success).toBe(false);
  });
});
