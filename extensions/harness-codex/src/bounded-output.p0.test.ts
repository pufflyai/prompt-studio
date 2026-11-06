import { expect, test } from "bun:test";
import { type ToolPart, toolResultBytes } from "@pstdio/sdk/extensions";
import { createAppServerItems } from "./app-server-items";
import { itemToMessage } from "./items";

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
