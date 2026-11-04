import { expect, test } from "bun:test";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { recentProjectResources } from "./recent-resources";

test("Home retains each resource's destination and uses session status presentation", () => {
  const target: NavigationTarget = { kind: "page", page: { kind: "page", id: "detail", extensionId: "example" } };
  const items = recentProjectResources([
    {
      resource: {
        type: "session",
        extensionId: "pstdio",
        id: "same",
        label: "Running",
        metadata: { status: "in_progress" },
      },
      target,
    },
    {
      resource: { type: "ticket", extensionId: "planner", id: "same", label: "Fix the button", icon: "component" },
      target,
    },
    {
      resource: {
        type: "session",
        extensionId: "pstdio",
        id: "other",
        label: "Done",
        metadata: { status: "completed" },
      },
      target,
    },
  ]);
  expect(items.map((item) => item.status)).toEqual(["in_progress", undefined, "completed"]);
  expect(items[0]!.id).not.toBe(items[1]!.id);
  expect(items[1]).toMatchObject({ title: "Fix the button", icon: "component", target });
});
