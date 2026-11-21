import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { createHash } from "node:crypto";
import { type SessionMessage, type ToolPart, toolResultBytes } from "@pstdio/sdk/extensions";
import { createAppServerItems } from "./app-server-items";
import { createAppServerOperation } from "./app-server-operation";
import { itemToMessage } from "./items";
import type { CodexThreadItem } from "./types";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("coalesces a burst of command output and publishes the final buffered result immediately", () => {
  const items: CodexThreadItem[] = [];
  const adapter = createAppServerItems((item) => items.push(item));
  const command = { id: "tool", type: "commandExecution", command: "print" };
  const receiveOutput = (delta: string) =>
    adapter.receive({ method: "item/commandExecution/outputDelta", params: { itemId: command.id, delta } });
  adapter.receive({ method: "item/started", params: { item: { ...command, status: "inProgress" } } });

  const chunk = 'A quoted "word", a backslash \\ and Unicode 😀\n'.repeat(30);
  for (let index = 0; index < 1024; index++) receiveOutput(chunk);
  expect(items).toHaveLength(1);

  jest.advanceTimersByTime(100);
  expect(items).toHaveLength(2);
  expect(items[1].resultSummary?.originalBytes).toBe(Buffer.byteLength(chunk) * 1024);

  const tail = "latest tail";
  receiveOutput(tail);
  adapter.receive({
    method: "item/completed",
    params: { item: { ...command, status: "completed", exitCode: 0 } },
  });
  expect(items).toHaveLength(3);
  const final = items[2];
  const fullOutput = chunk.repeat(1024) + tail;
  expect(final.status).toBe("completed");
  expect(final.aggregated_output?.endsWith(tail)).toBe(true);
  expect(final.resultSummary?.outputFingerprint).toBe(
    createHash("sha256").update(JSON.stringify(fullOutput)).digest("hex"),
  );
  expect(toolResultBytes(itemToMessage(final, "live")!.parts[0] as ToolPart)).toBeLessThanOrEqual(262144);
  jest.advanceTimersByTime(100);
  expect(items).toHaveLength(3);
});

test("preserves pending command output when the provider disconnects before completing the item", async () => {
  const messages: SessionMessage[] = [];
  let publications = 0;
  const operation = createAppServerOperation(
    {
      prompt: "Run a command",
      events: {
        getMessages: () => messages,
        push: (patch) => {
          messages[Number(patch.path.split("/").at(-1))] = patch.value as SessionMessage;
          publications++;
        },
      },
    },
    {
      transcriptPath: () => null,
      write: () => {},
      onFinish: () => {},
      onProtocolError: (error) => {
        throw error;
      },
      onLoginRejected: () => {},
    },
  );
  operation.startDelivery();
  operation.acknowledge("turn");
  const command = { id: "tool", type: "commandExecution", command: "print", status: "inProgress" };
  operation.receive({ method: "item/started", params: { item: command } });
  operation.receive({
    method: "item/commandExecution/outputDelta",
    params: { itemId: command.id, delta: "last data before disconnect" },
  });
  operation.finish({ status: "disconnected" });
  expect(await operation.done).toEqual({ status: "disconnected" });
  expect(messages.at(-1)?.parts[0]).toMatchObject({
    type: "tool",
    state: { output: "last data before disconnect" },
  });
  const count = publications;
  jest.advanceTimersByTime(100);
  expect(publications).toBe(count);
});

test("Codex keeps bounded streaming output and releases the complete final payload", () => {
  let latest: ToolPart | undefined;
  const adapter = createAppServerItems((item) => {
    expect(Buffer.byteLength(item.aggregated_output ?? "")).toBeLessThanOrEqual(262144);
    const part = itemToMessage(item, "live")?.parts[0];
    if (part?.type === "tool") latest = part;
  });
  adapter.receive({
    method: "item/started",
    params: { item: { id: "tool", type: "commandExecution", command: "print", status: "inProgress" } },
  });
  adapter.receive({ method: "item/commandExecution/outputDelta", params: { itemId: "tool", delta: "HEAD" } });
  for (let bytes = 0; bytes < 76_000_000; bytes += 1_000_000)
    adapter.receive({
      method: "item/commandExecution/outputDelta",
      params: { itemId: "tool", delta: "x".repeat(1_000_000) },
    });
  adapter.receive({ method: "item/commandExecution/outputDelta", params: { itemId: "tool", delta: "TAIL" } });
  jest.advanceTimersByTime(100);
  expect(toolResultBytes(latest!)).toBeLessThanOrEqual(262144);
  expect(latest?.state?.output).toMatch(/^HEAD[\s\S]*TAIL$/);
  adapter.receive({
    method: "item/completed",
    params: {
      item: {
        id: "tool",
        type: "commandExecution",
        status: "completed",
        exitCode: 1,
        aggregatedOutput: `HEAD${"x".repeat(76_000_000)}TAIL`,
      },
    },
  });
  expect(latest?.status).toBe("failed");
  expect(toolResultBytes(latest!)).toBeLessThanOrEqual(262144);
  expect(latest?.state?.output).toMatch(/^HEAD[\s\S]*TAIL$/);
});

test("structured Codex results are bounded before creating a complete serialized copy", () => {
  let latest: ToolPart | undefined;
  const adapter = createAppServerItems((item) => {
    expect(Buffer.byteLength(item.aggregated_output ?? "")).toBeLessThanOrEqual(262144);
    const part = itemToMessage(item, "live")?.parts[0];
    if (part?.type === "tool") latest = part;
  });
  adapter.receive({
    method: "item/completed",
    params: {
      item: {
        id: "tool",
        type: "mcpToolCall",
        status: "completed",
        result: Array.from({ length: 100000 }, (_, index) => ({ index, value: "small" })),
      },
    },
  });
  expect(toolResultBytes(latest!)).toBeLessThanOrEqual(262144);
  expect(latest?.state?.resultSummary?.omittedBytes).toBeGreaterThan(1000000);
});
