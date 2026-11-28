import { afterEach, expect, test } from "bun:test";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { dashboardChatDraftScope, dashboardChatDraftStorage, keepDashboardChatDraftsIn } from "./chat-draft-storage";

afterEach(() => keepDashboardChatDraftsIn(undefined));

test("desktop keeps chat drafts in its durable storage under a scope that survives a new runtime port", () => {
  const durable: WorkbenchStorageLike = { getItem: () => null, setItem: () => undefined };
  keepDashboardChatDraftsIn(durable);

  expect(dashboardChatDraftStorage()).toBe(durable);
  expect(dashboardChatDraftScope()).toBe("desktop");
});

test("the browser scopes chat drafts by its runtime address", () => {
  expect(dashboardChatDraftScope()).toEndWith("/");
  expect(dashboardChatDraftScope()).not.toBe("desktop");
});
