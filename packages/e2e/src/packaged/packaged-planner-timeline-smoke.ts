import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export async function expectPackagedPlannerTimeline(input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  metadata: WorkbenchExtensionMetadata;
}) {
  const { baseUrl, projectId, headers, metadata } = input;
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
  const execute = async (command: string, params: unknown) => {
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
}
