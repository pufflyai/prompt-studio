import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { workspacePresentation } from "./workspace";

test("only a persisted session with its selected available workspace exposes Open", async () => {
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const selected = { id: "a", name: "Workspace" };
  expect((await workspacePresentation(ctx, selected, { id: "a" })).openResourceId).toBeUndefined();
  expect(
    (await workspacePresentation(ctx, undefined, { id: "a", existingSession: true })).openResourceId,
  ).toBeUndefined();
  expect(
    (await workspacePresentation(ctx, selected, { id: "other", existingSession: true })).openResourceId,
  ).toBeUndefined();
  expect(
    (await workspacePresentation(ctx, selected, { id: "a", existingSession: true, available: false })).openResourceId,
  ).toBeUndefined();
  expect((await workspacePresentation(ctx, selected, { id: "a", existingSession: true })).openResourceId).toBe("a");
});
