import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { applyDashboardSessionMessagePatch, visibleSessionMessages } from "./session-messages";

const message = (id: string, text = id) =>
  ({ id, role: "user", parts: [{ type: "text", text }] }) satisfies SessionMessage;

test("streaming an update preserves unchanged visible messages", () => {
  const completed = message("completed");
  const history = [completed, message("streaming", "First chunk")];
  const before = visibleSessionMessages(history);
  const updated = message("streaming", "Second chunk");
  const after = visibleSessionMessages(
    applyDashboardSessionMessagePatch(history, { op: "replace", path: "/messages/1", value: updated }),
  );
  expect(before[0]).toBe(completed);
  expect(after[0]).toBe(before[0]);
  expect(after[1]).toBe(updated);
});

test("empty raw slots retain their patch indices", () => {
  const first = applyDashboardSessionMessagePatch([], {
    op: "replace",
    path: "/messages",
    value: [message("empty", ""), message("reply")],
  });
  const next = applyDashboardSessionMessagePatch(first, {
    op: "replace",
    path: "/messages/1",
    value: message("updated"),
  });
  expect(next).toEqual([message("empty", ""), message("updated")]);
});

test("an empty root replaces history and indexed patches cannot create holes", () => {
  expect(applyDashboardSessionMessagePatch([message("old")], { op: "replace", path: "/messages", value: [] })).toEqual(
    [],
  );
  expect(applyDashboardSessionMessagePatch([], { op: "replace", path: "/messages/4", value: message("hole") })).toEqual(
    [],
  );
});
