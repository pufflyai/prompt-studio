import { expect, test } from "bun:test";
import type { BoardView } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { createTicketCommand } from "../../commands/create-ticket";
import { requestHumanCommand, reviewCommand } from "../../commands/review-requests";
import { putAttempt } from "../../data/attempt-storage";
import { putTicket, statusesCollection, ticketsCollection } from "../../data/collections";
import { DEFAULT_STATUSES } from "../../data/seed";
import { createTicketTag } from "../../data/tag-operations";
import { timelineBoard } from "../../data/ticket-board";
import { createDeadlineCommand } from "./deadline-commands";
import { registerGate } from "./gate-store";
import { moveTicketCommand } from "./move-ticket";
import { readPlanCommand } from "./read-plan";

test("an invalid Track stops the snapshot before saved views can be initialized", async () => {
  const storage = createMemoryStorage();
  await createTicketTag({ storage, name: "Track", type: "multi_select" });
  let viewReads = 0;
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: {
      views: {
        list: async () => {
          viewReads++;
          return { views: [], defaultViewId: "default" };
        },
      },
    },
  });
  await expect(readPlanCommand.run(ctx, {})).rejects.toThrow();
  expect(viewReads).toBe(0);
});

test("the timeline snapshot includes its saved views and their default", async () => {
  const focused: BoardView = {
    id: "focused",
    boardId: "timeline-tickets",
    title: "Focus",
    builtIn: false,
    settings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: [] },
    filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Planned" }] },
    sorts: [],
  };
  const savedViews = { views: [focused], defaultViewId: focused.id };
  const [ctx] = makeCommandArgs({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      views: {
        list: async (view) => {
          expect(view).toEqual(timelineBoard);
          return savedViews;
        },
      },
    },
  });
  expect((await readPlanCommand.run(ctx, {})).savedViews).toEqual(savedViews);
});

test("the timeline carries gate instructions without copying ordinary ticket documents", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const ordinary = await createTicketCommand.run(ctx, {
    content: `# Work\n\n${"Detailed ticket notes. ".repeat(1000)}`,
  });
  const gate = await createTicketCommand.run(ctx, { content: "# Review\n\nInspect the result." });
  await registerGate(ctx, gate.id);
  const rows = (await readPlanCommand.run(ctx, {})).sections.flatMap(({ rows }) => rows);
  expect(rows.find(({ id }) => id === ordinary.id)?.instructions).toBe("");
  expect(rows.find(({ id }) => id === gate.id)?.instructions).toBe(gate.content);
});

test("the plan reads one ticket snapshot without loading workspace session histories", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const ticket = await createTicketCommand.run(ctx, { title: "Visible work", statusId: "ready" });
  let ticketReads = 0;
  let sessionReads = 0;
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => {
    const items = collection<T>(name);
    return {
      ...items,
      list: async () => {
        if (name === "tickets") ticketReads++;
        return items.list();
      },
    };
  };
  ctx.workspaces.list = async () => [
    { id: "workspace", anchors_json: [{ type: "ticket", id: ticket.id, label: ticket.shorthand }] } as never,
  ];
  ctx.sessions.query = async () => {
    sessionReads++;
    return { items: [], nextCursor: null };
  };
  const plan = await readPlanCommand.run(ctx, {});
  expect(plan.ticketRows).toContainEqual(
    expect.objectContaining({
      id: ticket.id,
      resource: expect.objectContaining({ type: "ticket", id: ticket.id, projectId: ctx.projectId }),
    }),
  );
  expect(ticketReads).toBe(1);
  expect(sessionReads).toBe(0);
});

test("the plan query derives milestone ETA from saved complexity and observed attempt starts", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const done = await createTicketCommand.run(ctx, { content: "# Finished work", statusId: "done" });
  const open = await createTicketCommand.run(ctx, { content: "# Remaining work", statusId: "ready" });
  await putTicket(storage, { ...done, tagIds: ["default-complexity-simple"] });
  await putTicket(storage, { ...open, tagIds: ["default-complexity-complex"] });
  const deadline = (await createDeadlineCommand.run(ctx, { date: "2030-01-01", name: "Release" }))!;
  await moveTicketCommand.run(ctx, { ticket: done.id, deadline: deadline.id });
  await moveTicketCommand.run(ctx, { ticket: open.id, deadline: deadline.id });
  const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await putAttempt(storage, {
    schemaVersion: 2,
    workspaceId: "owner-workspace",
    workspaceShorthand: "WS-1",
    ticketId: done.id,
    ticketShorthand: done.shorthand,
    implementationSessionId: "owner",
    base: { workspaceId: null, headSha: "base" },
    revisions: [],
    blocker: null,
    implementationDisconnectRetries: 0,
    reviewDisconnectRetries: 0,
    createdAt: startedAt,
    updatedAt: startedAt,
  });
  const plan = await readPlanCommand.run(ctx, {});
  const section = plan.sections.find(({ deadline: milestone }) => milestone?.id === deadline.id)!;
  expect(section.eta).toMatchObject({ completedComplexity: 1, totalComplexity: 4, startedAt });
  expect(section.eta!.remainingMs).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000);
  expect(section.counts).toMatchObject({ done: 1, total: 2 });
  expect(plan.sections.find(({ deadline }) => !deadline)?.eta).toBeNull();
});

test("uses Planner's configured status identities for progress, completion, and dependencies", async () => {
  const storage = createMemoryStorage();
  for (const status of DEFAULT_STATUSES) {
    await statusesCollection(storage).put(`project-${status.id}`, { ...status, id: `project-${status.id}` });
  }
  await statusesCollection(storage).put("project-wip", { ...DEFAULT_STATUSES[2]!, id: "project-wip", name: "WIP" });
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: {
      settings: {
        all: async () => ({
          "workflow.statuses": {
            completedStatusIds: ["project-done"],
            blockedStatusIds: ["project-blocked"],
            activeStatusIds: ["project-in-progress", "project-wip"],
            mergeTargetStatusId: "project-done",
          },
        }),
      },
    },
  });
  for (const status of await statusesCollection(storage).list())
    await statusesCollection(storage).put(status.id, { ...status, name: `Renamed ${status.id}` });
  const completed = await createTicketCommand.run(ctx, {
    content: "# Finished prerequisite",
    statusId: "project-done",
  });
  const progress = await createTicketCommand.run(ctx, {
    content: "# Active work",
    statusId: "project-in-progress",
    dependsOn: [completed.id],
  });
  const blocked = await createTicketCommand.run(ctx, { content: "# Blocked work", statusId: "project-blocked" });
  const wip = await createTicketCommand.run(ctx, { content: "# Work in progress", statusId: "project-wip" });
  const plan = await readPlanCommand.run(ctx, {});
  expect(plan.ticketRows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: progress.id,
        attributes: expect.objectContaining({ status: "project-in-progress" }),
      }),
      expect.objectContaining({ id: wip.id, attributes: expect.objectContaining({ status: "project-wip" }) }),
    ]),
  );
  const rows = plan.sections.flatMap((section) => section.rows);
  expect(rows.find((row) => row.id === completed.id)).toMatchObject({
    done: true,
    state: "done",
    status: { name: "Renamed project-done" },
  });
  expect(rows.find((row) => row.id === progress.id)).toMatchObject({
    state: "in-progress",
    dependsOn: [{ id: completed.id, done: true }],
  });
  expect(rows.find((row) => row.id === blocked.id)).toMatchObject({
    flags: expect.arrayContaining(["blocked"]),
  });
  expect(rows.find((row) => row.id === wip.id)).toMatchObject({
    state: "in-progress",
    status: { name: "Renamed project-wip" },
  });
});

test("preserves the configured status presentation independently of review state", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const status = { ...DEFAULT_STATUSES[0]!, id: "custom-backlog", name: "Queued", icon: "flag", color: "purple" };
  await statusesCollection(storage).put(status.id, status);
  const ticket = await createTicketCommand.run(ctx, { content: "# Custom workflow status", statusId: status.id });
  const row = (await readPlanCommand.run(ctx, {})).sections
    .flatMap((section) => section.rows)
    .find((row) => row.id === ticket.id);
  expect(row?.status).toMatchObject({ id: status.id, name: "Queued", icon: "flag", color: "purple" });
});

test("waiting for prerequisites is distinct from a blocker on otherwise available work", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const prerequisite = await createTicketCommand.run(ctx, { content: "# Prerequisite", statusId: "ready" });
  const waiting = await createTicketCommand.run(ctx, {
    content: "# Waiting for a prerequisite",
    statusId: "ready",
    dependsOn: [prerequisite.id],
  });
  const deferredBlocker = await createTicketCommand.run(ctx, {
    content: "# Waiting with an external blocker",
    statusId: "blocked",
    dependsOn: [prerequisite.id],
  });
  await putTicket(storage, { ...deferredBlocker, blockedReason: "Missing credentials" });
  const availableBlocker = await createTicketCommand.run(ctx, {
    content: "# Available but blocked",
    statusId: "ready",
  });
  await putTicket(storage, { ...availableBlocker, blockedReason: "Missing credentials" });

  const plan = await readPlanCommand.run(ctx, {});
  const rows = plan.sections.flatMap((section) => section.rows);
  for (const ticket of [waiting, deferredBlocker]) {
    const row = rows.find((row) => row.id === ticket.id)!;
    expect(row.state).toBe("not-started");
    expect(row.flags).toContain("waiting");
    expect(row.flags).not.toContain("blocked");
  }
  expect(rows.find((row) => row.id === availableBlocker.id)).toMatchObject({
    flags: expect.arrayContaining(["blocked"]),
  });
  expect(plan.sections[0]!.counts.blocked).toBe(1);

  await putTicket(storage, { ...prerequisite, statusId: "done" });
  const available = (await readPlanCommand.run(ctx, {})).sections.flatMap((section) => section.rows);
  expect(available.find((row) => row.id === waiting.id)?.flags).not.toContain("waiting");
  expect(available.find((row) => row.id === deferredBlocker.id)).toMatchObject({
    flags: expect.arrayContaining(["blocked"]),
  });
});

test("answering one request keeps another open request awaiting input", async () => {
  const storage = createMemoryStorage();
  const sessions = { create: async () => ({ type: "session", id: "chat", title: "Chat", status: "in_progress" }) };
  const [ctx] = makeCommandArgs({ storage, params: {}, overrides: { sessions: sessions as never } });
  const ticket = await createTicketCommand.run(ctx, { content: "# Mixed requests", statusId: "in-review" });
  const handoff = {
    kind: "decision",
    questions: [{ id: "result", label: "Result", required: true, input: { kind: "text" } }],
  };
  await requestHumanCommand.run(ctx, {
    ticket: ticket.id,
    reason: "approved-revision",
    title: "Approve the revision",
    instructions: "Select or merge it.",
    request: handoff,
  } as never);
  const task = await requestHumanCommand.run(ctx, {
    ticket: ticket.id,
    title: "Check the preview",
    instructions: "Confirm its layout.",
    request: { kind: "task" },
  } as never);
  await reviewCommand.run(ctx, { requestId: task.id, response: { confirmed: true } });

  const plan = await readPlanCommand.run(ctx, {});
  const row = plan.sections.flatMap((section) => section.rows).find((entry) => entry.id === ticket.id);
  expect(row).toMatchObject({ state: "await-input", flags: expect.arrayContaining(["human-needed"]) });
  expect(row?.requests.map((request) => request.state).sort()).toEqual(["answered", "open"]);
  expect(plan.sections.find((section) => section.rows.includes(row!))?.counts.humanNeeded).toBe(1);

  const handoffId = row?.requests.find((request) => request.state === "open")?.id as string;
  await reviewCommand.run(ctx, { requestId: handoffId, response: { answers: { result: "Merged A1." } } });
  const stateWith = async (statusId: string) => {
    await putTicket(storage, { ...(await ticketsCollection(storage).get(ticket.id))!, statusId });
    const rows = (await readPlanCommand.run(ctx, {})).sections.flatMap((section) => section.rows);
    return rows.find((entry) => entry.id === ticket.id)?.state;
  };
  expect(await stateWith("ready")).toBe("input-received");
  expect(await stateWith("in-progress")).toBe("in-progress");
});
