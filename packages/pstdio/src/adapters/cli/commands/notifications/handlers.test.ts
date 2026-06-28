import { describe, expect, mock, test } from "bun:test";
import type { Notification } from "@pstdio/sdk/api";
import { createHandler as createInboxHandler } from "../inbox";
import { createHandler as createListHandler } from "./list";
import { createHandler as createSendHandler } from "./send";
import { createHandler as createShowHandler } from "./show";
import { createHandler as createSnoozeHandler } from "./snooze";
import { createTransitionHandler } from "./transition";

const notification = (overrides?: Partial<Notification>): Notification => ({
  id: "notification-1",
  projectId: "project-1",
  title: "Review proposal",
  body: null,
  kind: "needs_review",
  status: "open",
  priority: "high",
  source: "api",
  origin: "core",
  related: [],
  actions: [],
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  ...overrides,
});

describe("notification CLI handlers", () => {
  test("sends notifications through the SDK", async () => {
    const create = mock(async () => notification({ id: "notification-created" }));
    const log = mock();
    const handler = createSendHandler({ api: { create } as never, log });

    await handler({
      "project-id": "project-1",
      kind: "needs_review",
      title: "Review proposal",
      body: "Ready for review",
      priority: "high",
      target: "ticket:PS-95",
      "dedupe-key": "ticket:PS-95",
    });

    expect(create).toHaveBeenCalledWith({
      projectId: "project-1",
      kind: "needs_review",
      title: "Review proposal",
      body: "Ready for review",
      priority: "high",
      target: { type: "ticket", id: "PS-95", label: "PS-95" },
      dedupeKey: "ticket:PS-95",
    });
    expect(log).toHaveBeenCalledWith("Created notification notification-created");
  });

  test("lists notifications with filters", async () => {
    const list = mock(async () => ({ items: [notification()] }));
    const log = mock();
    const handler = createListHandler({ api: { list } as never, log });

    await handler({ "project-id": "project-1", status: "open,snoozed", priority: "high", limit: 5 });

    expect(list).toHaveBeenCalledWith("project-1", {
      status: ["open", "snoozed"],
      priority: ["high"],
      limit: 5,
    });
    expect(log.mock.calls[0]?.[0]).toContain("notification-1");
  });

  test("inbox lists pending notifications", async () => {
    const list = mock(async () => ({ items: [notification()] }));
    const log = mock();
    const handler = createInboxHandler({ api: { list } as never, log });

    await handler({ "project-id": "project-1" });

    expect(list).toHaveBeenCalledWith("project-1", {
      status: undefined,
      priority: undefined,
      limit: undefined,
    });
    expect(log.mock.calls[0]?.[0]).toContain("Review proposal");
  });

  test("shows notification details", async () => {
    const get = mock(async () => notification({ body: "Ready for review" }));
    const log = mock();
    const handler = createShowHandler({ api: { get } as never, log });

    await handler({ "project-id": "project-1", id: "notification-1" });

    expect(get).toHaveBeenCalledWith("project-1", "notification-1");
    expect(log.mock.calls[0]?.[0]).toContain("Body:     Ready for review");
  });

  test("transitions notifications", async () => {
    const markRead = mock(async () => notification({ status: "read" }));
    const markDone = mock(async () => notification({ status: "done" }));
    const dismiss = mock(async () => notification({ status: "dismissed" }));
    const log = mock();
    const api = { markRead, markDone, dismiss } as never;

    await createTransitionHandler("markRead", "Read", { api, log })({
      "project-id": "project-1",
      id: "notification-1",
    });
    await createTransitionHandler("markDone", "Done", { api, log })({
      "project-id": "project-1",
      id: "notification-1",
    });
    await createTransitionHandler("dismiss", "Dismissed", { api, log })({
      "project-id": "project-1",
      id: "notification-1",
    });

    expect(markRead).toHaveBeenCalledWith("project-1", "notification-1");
    expect(markDone).toHaveBeenCalledWith("project-1", "notification-1");
    expect(dismiss).toHaveBeenCalledWith("project-1", "notification-1");
    expect(log).toHaveBeenCalledWith("Read notification notification-1");
    expect(log).toHaveBeenCalledWith("Done notification notification-1");
    expect(log).toHaveBeenCalledWith("Dismissed notification notification-1");
  });

  test("snoozes notifications", async () => {
    const snooze = mock(async () => notification({ status: "snoozed" }));
    const log = mock();
    const handler = createSnoozeHandler({ api: { snooze } as never, log });

    await handler({ "project-id": "project-1", id: "notification-1", until: "2026-01-02T10:00:00.000Z" });

    expect(snooze).toHaveBeenCalledWith("project-1", "notification-1", "2026-01-02T10:00:00.000Z");
    expect(log).toHaveBeenCalledWith("Snoozed notification notification-1 until 2026-01-02T10:00:00.000Z");
  });
});
