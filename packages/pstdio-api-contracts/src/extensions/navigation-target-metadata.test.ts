import { expect, test } from "bun:test";
import { commandOutcomeSchema, extensionRendererContextSchema } from "./execute";
import { navigationTargetSchema } from "./navigation-target-metadata";

test("navigation metadata and command outcomes retain page and parent params", () => {
  const page = { kind: "page" as const, extensionId: "acme", id: "board" };
  const target = {
    kind: "page" as const,
    page,
    params: { range: "now-6h", refresh: 60 },
    parent: { kind: "page" as const, page: { ...page, id: "parent" }, params: { filter: ["a", "b"] } },
  };
  expect(navigationTargetSchema.parse(target)).toEqual(target);
  const compound = { kind: "compound" as const, targets: [target] };
  expect(navigationTargetSchema.parse(compound)).toEqual(compound);
  expect(
    commandOutcomeSchema.parse({ ok: true, status: "success", navigationRequests: [target] }).navigationRequests,
  ).toEqual([target]);
});

test("renderer context metadata retains typed page params", () => {
  const context = { rendererId: "board", pageParams: { range: "now-6h", refresh: 30, live: true, tags: ["codex"] } };
  expect(extensionRendererContextSchema.parse(context)).toEqual(context);
});
