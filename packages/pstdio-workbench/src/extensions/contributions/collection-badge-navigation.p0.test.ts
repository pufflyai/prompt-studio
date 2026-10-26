import { expect, test } from "bun:test";
import type { NavigationTargetPage } from "@pstdio/sdk/extensions";
import { collectionBadgeTarget } from "./collection-badge-navigation";

test("a collection badge opens its declared page in the contributing extension and project", () => {
  const target: NavigationTargetPage = {
    kind: "page",
    page: { kind: "page", id: "requests" },
    resource: { type: "ticket", id: "ticket-1" },
    parent: { kind: "page", page: { kind: "page", id: "ticket" } },
  };
  const row = { id: "ticket-1", title: "Ticket", attributes: { badges: [{ id: "review", label: "2", target }] } };
  expect(collectionBadgeTarget(row, "badges", "review", "example.planner", "project-1")).toMatchObject({
    kind: "page",
    page: { extensionId: "example.planner", id: "requests" },
    resource: { type: "ticket", id: "ticket-1", extensionId: "example.planner", projectId: "project-1" },
    parent: { kind: "page", page: { extensionId: "example.planner", id: "ticket" } },
  });
});

test("a collection badge opens a page-owned panel without navigating away", () => {
  const row = {
    id: "ticket-1",
    title: "Ticket",
    attributes: {
      badges: [
        {
          id: "attention",
          label: "2",
          target: { kind: "page", page: { kind: "page", id: "old-requests" } },
          action: {
            kind: "panel",
            panel: { kind: "page-slot", page: { kind: "page", id: "tickets" }, id: "attention" },
            resource: { type: "ticket", id: "ticket-1" },
            open: "preview",
          },
        },
      ],
    },
  };
  expect(collectionBadgeTarget(row, "badges", "attention", "example.planner", "project-1")).toMatchObject({
    kind: "panel",
    panel: { kind: "page-slot", page: { extensionId: "example.planner", id: "tickets" }, id: "attention" },
    resource: { type: "ticket", id: "ticket-1", extensionId: "example.planner", projectId: "project-1" },
    open: "preview",
  });
});
