import { expect, test } from "bun:test";
import { resourceContextIndicator } from "./resource-context-indicator";

test("derives the actual workspace or project from resource relationships", () => {
  const owner = { type: "workspace", id: "w1", projectId: "p1" };
  const resource = {
    type: "session",
    id: "s1",
    context: { type: "workspace" as const, id: "w2", projectId: "p1", label: "Workspace 2" },
  };
  expect(resourceContextIndicator(owner, resource)?.label).toBe("Outside this workspace · Workspace 2");
  expect(resourceContextIndicator(owner, { ...resource, context: { ...resource.context, id: "w1" } })).toBeUndefined();
  expect(resourceContextIndicator(owner, { ...resource, context: { type: "project", id: "p1" } })?.label).toBe(
    "Outside this workspace · Project p1",
  );
  expect(resourceContextIndicator(owner, { ...resource, context: { type: "workspace", id: "w2" } })?.label).toBe(
    "Outside this workspace · Workspace w2",
  );
  expect(resourceContextIndicator(undefined, resource)).toBeUndefined();
  expect(
    resourceContextIndicator(owner, {
      ...resource,
      projectId: "p1",
      context: { type: "workspace", id: "w1", label: "Workspace 1" },
    }),
  ).toBeUndefined();
  expect(resourceContextIndicator(owner, { type: "session", id: "unknown" })).toBeUndefined();
});
