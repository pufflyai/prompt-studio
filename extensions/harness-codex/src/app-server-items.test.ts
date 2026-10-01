import { expect, test } from "bun:test";
import type { ToolPart } from "@pstdio/sdk/extensions";
import { createAppServerItems } from "./app-server-items";
import { recoverCodexMessages } from "./history-reconciliation";
import { itemToMessage } from "./items";
import { normalizeRollout } from "./rollout";
import type { CodexThreadItem } from "./types";

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
  const known = itemToMessage(items[0], "live")!;
  const native = normalizeRollout(
    JSON.stringify({
      type: "event_msg",
      payload: {
        type: "item_completed",
        item: {
          id: "patch-1",
          type: "FileChange",
          status: "completed",
          changes: { "/repo/notes.md": { type: "update" } },
        },
      },
    }),
  );
  const result = recoverCodexMessages({ knownMessages: [known], nativeMessages: native });
  expect(result.kind).toBe("recovered");
  if (result.kind !== "recovered") return;
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0].id).toBe(known.id);
  expect(result.messages[0].parts[0] as ToolPart).toMatchObject({ callId: "patch-1", status: "completed" });
});
