import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { commandRunner, configurePlannerWorkflow } from "./packaged-planner-helpers";
import { expectPackagedPlannerMoves } from "./packaged-planner-moves-smoke";
import { expectIndependentPlannerViews } from "./packaged-planner-views-smoke";

export async function expectPackagedPlannerTimeline(input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  metadata: WorkbenchExtensionMetadata;
}) {
  const { metadata } = input;
  expect(metadata.pages).toContainEqual(
    expect.objectContaining({
      extensionId: "pstdio.pstdio-planner",
      localId: "ticket-requests",
      path: "ticket-requests",
    }),
  );
  expect(metadata.pages).toContainEqual(
    expect.objectContaining({
      extensionId: "pstdio.pstdio-planner",
      localId: "timeline",
      path: "ticket-timeline",
    }),
  );
  const view = metadata.views.find(
    (view) => view.extensionId === "pstdio.pstdio-planner" && view.localId === "timeline",
  );
  expect(view?.body.kind).toBe("webview");
  const planningNavigation = metadata.navigationItems.filter((item) => {
    if (item.extensionId !== "pstdio.pstdio-planner" || item.action.kind !== "page") return false;
    return ["tickets", "timeline"].includes(item.action.page.id);
  });
  expect(planningNavigation).toHaveLength(2);
  expect(planningNavigation[0]?.group).toBeTruthy();
  expect(planningNavigation[1]?.group).toBe(planningNavigation[0]?.group);
  expect(planningNavigation.every((item) => item.icon)).toBe(true);
  const execute = commandRunner(input);
  const { statusId } = await configurePlannerWorkflow(execute);
  await expectIndependentPlannerViews({ ...input, execute });
  await expectAgentOwnedStatus(execute);
  const deadline = await execute("timeline.deadline.create", { date: "2026-10-15", name: "Preview" });
  const result = await execute("timeline.ticket.create", {
    content: "# Timeline smoke ticket\n\nShared Planner body",
    deadline: deadline.id,
  });
  expect(result).toMatchObject({
    ticket: { title: "Timeline smoke ticket", content: "# Timeline smoke ticket\n\nShared Planner body" },
    placementError: null,
  });
  const waiting = await execute("timeline.ticket.create", {
    content: "# Waiting for the smoke prerequisite",
    dependsOn: [result.ticket.id],
    deadline: deadline.id,
  });
  const blocked = await execute("timeline.ticket.create", {
    content: "# Available work with a blocker",
    deadline: deadline.id,
  });
  await execute("update-ticket", { id: blocked.ticket.id, blockedReason: "Missing credentials" });
  const plan = await execute("timeline.plan.read", {});
  expect(plan.sections).toContainEqual(
    expect.objectContaining({
      deadline: expect.objectContaining({ id: deadline.id }),
      eta: null,
      rows: expect.arrayContaining([expect.objectContaining({ id: result.ticket.id })]),
    }),
  );
  const rows = plan.sections.flatMap((section: { rows: unknown[] }) => section.rows);
  expect(rows).toContainEqual(expect.objectContaining({ id: result.ticket.id, instructions: "" }));
  expect(rows).toContainEqual(
    expect.objectContaining({
      id: waiting.ticket.id,
      state: "not-started",
      flags: expect.arrayContaining(["waiting"]),
    }),
  );
  expect(rows).toContainEqual(
    expect.objectContaining({ id: blocked.ticket.id, state: "blocked", flags: expect.arrayContaining(["blocked"]) }),
  );
  await execute("update-ticket", { id: result.ticket.id, status: "Done" });
  // Only this ticket carries the tag, so the saved scope follows it after it is reopened.
  await execute("update-ticket", { id: result.ticket.id, tags: ["Urgent"] });
  // Only completed tickets are eligible, so the run has no new work and starts no supervisor.
  const { revision } = await execute("auto-build.configure", {
    enabled: true,
    prompt: "Finish the preview.",
    eligible: {
      conjunction: "and",
      rules: [{ attributeId: "status", condition: "is-any-of", value: [statusId("Done")] }],
    },
  });
  // The background check that enabling queues can hold the supervisor write guard briefly.
  for (let attempt = 0; ; attempt++) {
    try {
      await execute("auto-build.scope", { revision, queries: [{ tags: ["Urgent"] }] });
      break;
    } catch (error) {
      if (attempt >= 50 || !String(error).includes("Another Planner write is running")) throw error;
      await Bun.sleep(100);
    }
  }
  expect(await execute("auto-build.read", {})).toMatchObject({ completed: true });
  await execute("update-ticket", {
    id: result.ticket.id,
    status: "Todo",
    blockedReason: "Hold dispatch during completion validation",
  });
  expect(await execute("auto-build.read", {})).toMatchObject({ completed: false });
  await execute("auto-build.configure", { enabled: false });
  await execute("update-ticket", { id: result.ticket.id, status: "Done", blockedReason: "" });
  const availablePlan = await execute("timeline.plan.read", {});
  const available = availablePlan.sections.flatMap(
    (section: { rows: { id: string; flags: string[] }[] }) => section.rows,
  );
  expect(available.find((row: { id: string }) => row.id === waiting.ticket.id).flags).not.toContain("waiting");
  const tickets = await execute("read-tickets", {});
  expect(tickets).toContainEqual(expect.objectContaining({ id: result.ticket.id }));
  await expectSharedMilestoneProperties(execute, result.ticket.id, deadline.id);
  await expectReviewRequests(execute, deadline.id);
  await expectPackagedPlannerMoves(input);
}

async function expectSharedMilestoneProperties(execute: Execute, ticketId: string, deadlineId: string) {
  const query = await execute("query-tickets", {});
  expect(query.attributes).toContainEqual(
    expect.objectContaining({ id: "milestone", filterable: true, displayable: true }),
  );
  expect(query.rows.find((row: { id: string }) => row.id === ticketId).attributes).toMatchObject({
    milestone: deadlineId,
    milestoneDate: "2026-10-15",
  });
  await execute("set-ticket-attribute", { rowId: ticketId, attributeId: "milestone", value: "" });
  const moved = await execute("timeline.plan.read", {});
  expect(moved.sections.find((section: { deadline: unknown }) => !section.deadline).rows).toContainEqual(
    expect.objectContaining({ id: ticketId, status: expect.objectContaining({ name: "Done" }) }),
  );
  await execute("set-ticket-attribute", { rowId: ticketId, attributeId: "milestone", value: deadlineId });
}

type Execute = ReturnType<typeof commandRunner>;

async function expectAgentOwnedStatus(execute: Execute) {
  const ticket = await execute("create-ticket", { content: "# Live implementation status", status: "Todo" });
  await execute("implement-ticket", {
    id: ticket.id,
    agent: { harnessId: "pstdio.workbench-fixture.harness.fake" },
  });
  const plan = await execute("timeline.plan.read", {});
  expect(plan.sections.flatMap((section: { rows: unknown[] }) => section.rows)).toContainEqual(
    expect.objectContaining({ id: ticket.id, status: expect.objectContaining({ name: "Todo" }) }),
  );
  const query = await execute("query-tickets", {});
  expect(query.rows).toContainEqual(
    expect.objectContaining({ id: ticket.id, attributes: expect.objectContaining({ status: ticket.statusId }) }),
  );
}

// Review requests start from empty storage; answering one request must not hide another.
async function expectReviewRequests(execute: Execute, deadlineId: string) {
  const { ticket } = await execute("timeline.ticket.create", {
    content: "# Review request smoke",
    deadline: deadlineId,
  });
  const handoff = await execute("request-human", {
    ticket: ticket.id,
    reason: "approved-revision",
    title: "Approve the revision",
    instructions: "Select or merge it.",
    request: {
      kind: "decision",
      questions: [{ id: "result", label: "Result", required: true, input: { kind: "text" } }],
    },
  });
  const task = await execute("request-human", {
    ticket: ticket.id,
    title: "Check the preview",
    instructions: "Confirm its layout.",
    request: { kind: "task" },
  });
  const decision = await execute("request-human", {
    ticket: ticket.id,
    title: "Choose platforms",
    instructions: "Pick the release platforms.",
    request: {
      kind: "decision",
      questions: [
        {
          id: "platforms",
          label: "Platforms",
          required: true,
          input: {
            kind: "multiple-choice",
            options: [
              { id: "mac", label: "macOS" },
              { id: "win", label: "Windows" },
            ],
          },
        },
      ],
    },
  });
  await execute("set-ticket-tags", { rowId: ticket.id, tagIds: [] });
  expect(await execute("review-requests.list", { ticket: ticket.id, openOnly: true })).toMatchObject({
    requests: expect.arrayContaining([expect.objectContaining({ id: task.id })]),
  });
  for (const request of [handoff, task, decision]) {
    expect(request).toMatchObject({ state: "open", context: { sessionId: null } });
  }

  await execute("review", { requestId: task.id, response: { confirmed: true } });
  await execute("review", { requestId: decision.id, response: { answers: { platforms: ["mac", "win"] } } });
  await execute("review", { requestId: decision.id, response: { answers: { platforms: ["win"] } } });
  expect(await execute("review-requests.read", { requestId: decision.id })).toMatchObject({
    state: "answered",
    context: { sessionId: null },
    outcome: { response: { answers: { platforms: ["win"] } } },
  });
  const conversation = await execute("review-requests.open", { requestId: decision.id });
  expect(conversation).toMatchObject({ type: "session", id: expect.any(String) });
  expect(await execute("review-requests.open", { requestId: decision.id })).toEqual(conversation);
  expect(await execute("review-requests.read", { requestId: decision.id })).toMatchObject({
    state: "answered",
    context: { sessionId: conversation.id },
    outcome: { response: { answers: { platforms: ["win"] } } },
  });
  const mixed = await execute("timeline.plan.read", {});
  const row = mixed.sections
    .flatMap((section: { rows: Array<{ id: string }> }) => section.rows)
    .find((entry: { id: string }) => entry.id === ticket.id);
  expect(row).toMatchObject({ state: "await-input", flags: expect.arrayContaining(["human-needed"]) });
  expect(mixed.ticketRows).toContainEqual(
    expect.objectContaining({ id: ticket.id, attributes: expect.objectContaining({ reviewRequests: "requested" }) }),
  );
  expect(
    mixed.ticketRows.find((entry: { id: string }) => entry.id === ticket.id).attributes.reviewRequestItems,
  ).toMatchObject([
    { label: "1", icon: "message-circle-warning", color: "orange", target: { page: { id: "ticket-requests" } } },
  ]);
  const tree = await execute("ticket-files.tree.body", {
    renderer: { rendererId: "pstdio.pstdio-planner.view.ticket-files", resource: { type: "ticket", id: ticket.id } },
  });
  expect(tree[0].nodes.find((node: { id: string }) => node.id === "review-requests")).toMatchObject({
    icon: "message-circle-warning",
    badge: { label: "1", color: "orange" },
  });
  expect(await execute("review-requests.list", { ticket: ticket.id, openOnly: true })).toMatchObject({
    requests: [{ id: handoff.id }],
  });

  await execute("review-requests.cancel", { requestId: handoff.id, reason: "Superseded by a new revision." });
  expect((await execute("timeline.plan.read", {})).ticketRows).toContainEqual(
    expect.objectContaining({ id: ticket.id, attributes: expect.objectContaining({ reviewRequests: "answered" }) }),
  );
  const settled = await execute("review-requests.read", { requestId: decision.id });
  expect(settled).toMatchObject({ state: "answered", outcomeText: "Platforms: Windows" });
  const resolved = await execute("timeline.plan.read", {});
  expect(
    resolved.ticketRows.find((entry: { id: string }) => entry.id === ticket.id).attributes.reviewRequestItems,
  ).toMatchObject([{ label: "3", color: "green" }]);
}
