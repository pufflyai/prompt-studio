import { expect, test } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { applyDashboardSessionMessagePatch } from "./session-messages";

const message = (id: string, text = id) =>
  ({ id, role: "user", parts: [{ type: "text", text }] }) satisfies SessionMessage;

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
