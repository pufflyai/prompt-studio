import { expect, test } from "bun:test";
import { applySessionMessagePatch } from "./index";

const message = (id: string, text = id) => ({
  id,
  role: "user" as const,
  createdAt: 1793923200000,
  parts: [{ type: "text" as const, text }],
});

test("the public SDK applies canonical message indexes without a UI runtime", () => {
  const first = message("first");
  const second = message("second");
  const added = applySessionMessagePatch([first], { op: "add", path: "/messages/1", value: second });
  expect(added).toEqual([first, second]);
  const updated = message("second", "updated");
  const replaced = applySessionMessagePatch(added, { op: "replace", path: "/messages/1", value: updated });
  expect(replaced).toEqual([first, updated]);
  expect(applySessionMessagePatch(replaced, { op: "remove", path: "/messages/0" })).toEqual([updated]);
  expect(applySessionMessagePatch(replaced, { op: "replace", path: "/messages/20", value: first })).toBe(replaced);
});

test("canonical prompt ID replacements keep their presentation identity and respect explicit provider keys", () => {
  const optimistic = { ...message("optimistic", "Same prompt"), animationKey: "pending" };
  const confirmed = message("confirmed", "Same prompt");
  const replaced = applySessionMessagePatch([optimistic], { op: "replace", path: "/messages/0", value: confirmed });
  expect(replaced[0]).toMatchObject({ id: "confirmed", animationKey: "pending" });
  const delivered = applySessionMessagePatch(replaced, {
    op: "replace",
    path: "/messages",
    value: [message("delivered", "Same prompt")],
  });
  expect(delivered[0]).toMatchObject({ id: "delivered", animationKey: "pending" });
  expect(
    applySessionMessagePatch(delivered, {
      op: "replace",
      path: "/messages/0",
      value: { ...confirmed, animationKey: "provider-owned" },
    })[0],
  ).toMatchObject({ animationKey: "provider-owned" });
});

test("snapshot reordering follows message IDs without assigning another prompt's presentation identity", () => {
  const first = { ...message("one"), animationKey: "one-pending" };
  const second = { ...message("two"), animationKey: "two-pending" };
  const moved = applySessionMessagePatch([first, second], {
    op: "replace",
    path: "/messages",
    value: [message("two"), message("one")],
  });
  expect(moved.map((item) => [item.id, item.animationKey])).toEqual([
    ["two", "two-pending"],
    ["one", "one-pending"],
  ]);
  expect(
    applySessionMessagePatch(moved, {
      op: "replace",
      path: "/messages/1",
      value: message("unrelated", "Different prompt"),
    })[1]?.animationKey,
  ).toBeUndefined();
});
