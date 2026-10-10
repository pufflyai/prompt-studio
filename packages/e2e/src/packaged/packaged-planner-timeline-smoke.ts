import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

// Run a Planner command through the packaged HTTP API and return its value.
const commandRunner =
  (input: { baseUrl: string; projectId: string; headers: Record<string, string> }) =>
  async (command: string, params: unknown) => {
    const { baseUrl, projectId, headers } = input;
    const response = await fetch(
      `${baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
      {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ params }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome.status, JSON.stringify(body)).toBe("success");
    return body.outcome.value;
  };

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
      rows: expect.arrayContaining([expect.objectContaining({ id: result.ticket.id })]),
    }),
  );
  const rows = plan.sections.flatMap((section: { rows: unknown[] }) => section.rows);
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
  const availablePlan = await execute("timeline.plan.read", {});
  const available = availablePlan.sections.flatMap(
    (section: { rows: { id: string; flags: string[] }[] }) => section.rows,
  );
  expect(available.find((row: { id: string }) => row.id === waiting.ticket.id).flags).not.toContain("waiting");
  const tickets = await execute("read-tickets", {});
  expect(tickets).toContainEqual(expect.objectContaining({ id: result.ticket.id }));
  await expectSharedMilestoneProperties(execute, result.ticket.id, deadline.id);
  await expectReviewRequests(execute, deadline.id);
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
const reviewNeeded = "default-human-requested-true";

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
  expect(handoff).toMatchObject({ state: "open", context: { sessionId: expect.any(String) } });

  await execute("review", { requestId: task.id, response: { confirmed: true } });
  await execute("review", { requestId: decision.id, response: { answers: { platforms: ["mac", "win"] } } });
  const mixed = await execute("timeline.plan.read", {});
  const row = mixed.sections
    .flatMap((section: { rows: Array<{ id: string }> }) => section.rows)
    .find((entry: { id: string }) => entry.id === ticket.id);
  expect(row).toMatchObject({ state: "await-input", flags: expect.arrayContaining(["human-needed"]) });
  expect(await execute("review-requests.list", { ticket: ticket.id, openOnly: true })).toMatchObject({
    requests: [{ id: handoff.id }],
  });

  await execute("review-requests.cancel", { requestId: handoff.id, reason: "Superseded by a new revision." });
  const settled = await execute("review-requests.read", { requestId: decision.id });
  expect(settled).toMatchObject({ state: "answered", outcomeText: "Platforms: macOS, Windows" });
  const [stored] = (await execute("read-tickets", {})).filter((entry: { id: string }) => entry.id === ticket.id);
  expect(stored.tagIds ?? []).not.toContain(reviewNeeded);
}
