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
  const plan = await execute("timeline.plan.read", {});
  expect(plan.sections).toContainEqual(
    expect.objectContaining({
      deadline: expect.objectContaining({ id: deadline.id }),
      rows: expect.arrayContaining([expect.objectContaining({ id: result.ticket.id })]),
    }),
  );
  const tickets = await execute("read-tickets", {});
  expect(tickets).toContainEqual(expect.objectContaining({ id: result.ticket.id }));
}
