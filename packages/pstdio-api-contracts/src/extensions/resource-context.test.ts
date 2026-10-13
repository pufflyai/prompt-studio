import { expect, test } from "bun:test";
import { isNavigationTarget, qualifyNavigationTarget } from "../extension-kernel/navigation";
import { navigationTargetSchema } from "./navigation-target-metadata";

test("navigation metadata and bridge qualification preserve canonical context and requested mode", () => {
  const target = {
    kind: "page" as const,
    page: { kind: "page" as const, extensionId: "test", id: "home" },
    mode: { kind: "mode" as const, id: "music" },
    resource: {
      type: "session",
      id: "s1",
      context: { type: "workspace" as const, id: "w2", projectId: "p1", label: "Workspace 2" },
    },
  };
  const qualified = qualifyNavigationTarget(target, "test", "p1");
  expect(navigationTargetSchema.parse(qualified)).toMatchObject({
    mode: { extensionId: "test", id: "music" },
    resource: { context: target.resource.context },
  });
});

test("resource relationship metadata rejects incomplete and conflicting contexts", () => {
  const target = {
    kind: "panel",
    panel: { kind: "placement", extensionId: "test", id: "sessions" },
    resource: { type: "session", id: "s1", context: { type: "workspace", label: "Workspace 2" } },
  };
  expect(navigationTargetSchema.safeParse(target).success).toBe(false);
  expect(isNavigationTarget(target)).toBe(false);
  expect(
    navigationTargetSchema.safeParse({
      ...target,
      resource: { ...target.resource, context: { type: "project", id: "p1", projectId: "p2" } },
    }).success,
  ).toBe(false);
});
