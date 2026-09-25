import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { planSmokePages } from "./smoke-plan";

const page = (localId: string) =>
  ({
    id: `acme.test.page.${localId}`,
    localId,
    extensionId: "acme.test",
    title: "Same label",
    path: localId,
    mode: { extensionId: "pstdio", kind: "mode", id: "project" },
    main: { kind: "view", view: { extensionId: "acme.test", kind: "view", id: "overview" }, cardinality: "one" },
    slots: [],
  }) satisfies WorkbenchExtensionMetadata["pages"][number];
test("visits resource-free pages with resolvable parents and permits duplicate labels", () => {
  const root = page("root");
  const child = { ...page("child"), parent: { extensionId: "acme.test", kind: "page" as const, id: "root" } };
  const bound = { ...page("bound"), parent: { extensionId: "pstdio", kind: "page" as const, id: "workspace" } };
  const result = planSmokePages([root, child, bound], "acme.test", "p1");
  expect(result.pages.map((item) => item.page.id)).toEqual([root.id, child.id]);
  expect(result.pages[1]!.url).toBe("/projects/p1/extensions/acme.test/child");
  expect(result.unexercised).toMatchObject([{ contributionId: bound.id, reason: expect.stringContaining("resource") }]);
});
