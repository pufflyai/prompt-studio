import { expect, test } from "bun:test";
import { relatedChips } from "./related-chips";

test("related chips retain provider ownership when local resource IDs collide", () => {
  const alice = { type: "ticket", id: "one", extensionId: "alice.planner", projectId: "project" };
  const bob = { ...alice, extensionId: "bob.planner" };
  const resolutions = [
    {
      resource: { ...alice, label: "Alice ticket" },
      target: { kind: "page" as const, page: { kind: "page" as const, id: "alice" } },
    },
    {
      resource: { ...bob, label: "Bob ticket" },
      target: { kind: "page" as const, page: { kind: "page" as const, id: "bob" } },
    },
  ];
  const chips = relatedChips([alice, bob], resolutions);
  expect(chips.map((chip) => chip.label)).toEqual(["Alice ticket", "Bob ticket"]);
  expect(chips.map((chip) => chip.action)).toEqual(resolutions.map((item) => item.target));
  expect(chips[0].id).not.toBe(chips[1].id);
});
