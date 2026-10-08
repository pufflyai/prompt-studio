import { expect, test } from "bun:test";
import type { ToolPart } from "@pstdio/sdk/extensions";
import { createAppServerItems } from "./app-server-items";
import { itemToMessage } from "./items";
import { nativeItemMessage, recoverNativeHistory } from "./native-history";
import type { CodexThreadItem } from "./types";

for (const result of [false, 0, "", null]) {
  test(`preserves MCP result ${JSON.stringify(result)}`, () => {
    const items: CodexThreadItem[] = [];
    const adapter = createAppServerItems((item) => items.push(item));
    adapter.receive({
      method: "item/completed",
      params: {
        item: {
          id: "mcp-result",
          type: "mcpToolCall",
          server: "test",
          tool: "read",
          result,
          aggregatedOutput: "fallback",
        },
      },
    });
    expect(items[0].aggregated_output).toBe(JSON.stringify(result));
  });
}
test("Code Mode native calls retain their arguments and output in live and restored history", () => {
  const native = {
    id: "code",
    type: "dynamicToolCall",
    namespace: "functions",
    tool: "exec",
    arguments: { code: "return 42" },
    status: "completed",
    success: true,
    contentItems: [{ type: "inputText", text: "42" }],
    durationMs: 1,
  } as const;
  const items: CodexThreadItem[] = [];
  const adapter = createAppServerItems((item) => items.push(item));
  adapter.receive({ method: "item/completed", params: { item: native } });
  const live = itemToMessage(items[0], "codex-turn")!;
  expect(live.parts[0]).toMatchObject({
    tool: "functions.exec",
    state: { input: { code: "return 42" }, output: JSON.stringify(native.contentItems) },
  });
  expect(nativeItemMessage(native as unknown as Parameters<typeof nativeItemMessage>[0], "turn")).toEqual(live);
});

test("shows native plan progress and updates it within the same turn", () => {
  const items: CodexThreadItem[] = [];
  const adapter = createAppServerItems((item) => items.push(item));
  const params = { threadId: "thread-1", turnId: "turn-1", plan: [{ step: "Update notes", status: "inProgress" }] };
  adapter.receive({ method: "turn/plan/updated", params });
  adapter.receive({
    method: "turn/plan/updated",
    params: { ...params, plan: [{ step: "Update notes", status: "completed" }] },
  });
  expect(items).toHaveLength(2);
  expect(items[0].id).toBe(items[1].id);
  expect(itemToMessage(items[0], "live")?.parts[0]).toMatchObject({
    tool: "update_plan",
    state: { input: { items: [{ text: "Update notes", completed: false }] } },
  });
  expect(itemToMessage(items[1], "live")?.parts[0]).toMatchObject({
    tool: "update_plan",
    status: "completed",
    state: { input: { items: [{ text: "Update notes", completed: true }] } },
  });
});

test("recovers a native file change result onto the patch shown in the live stream", () => {
  const items: CodexThreadItem[] = [];
  const adapter = createAppServerItems((item) => items.push(item));
  adapter.receive({
    method: "item/started",
    params: {
      item: {
        id: "patch-1",
        type: "fileChange",
        status: "inProgress",
        changes: [{ path: "/repo/notes.md", kind: { type: "update", move_path: null }, diff: "@@ -1 +1 @@\n-a\n+b\n" }],
      },
    },
  });
  const known = itemToMessage(items[0], "codex-turn-1")!;
  const native = nativeItemMessage(
    {
      id: "patch-1",
      type: "fileChange",
      status: "completed",
      changes: [{ path: "/repo/notes.md", kind: { type: "update", move_path: null }, diff: "@@ -1 +1 @@\n-a\n+b\n" }],
    },
    "turn-1",
  )!;
  const result = recoverNativeHistory({ knownMessages: [known], nativeMessages: [native] });
  expect(result.kind).toBe("recovered");
  if (result.kind !== "recovered") return;
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0].id).toBe(known.id);
  expect(result.messages[0].parts[0] as ToolPart).toMatchObject({ callId: "patch-1", status: "completed" });
});
