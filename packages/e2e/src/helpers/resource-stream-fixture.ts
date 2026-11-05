import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type APIRequestContext, expect } from "@playwright/test";
import { writeCommandStreamExtension } from "./command-stream-extension";
import { folderProjectInput } from "./folder-project";
import { createPlannerTicket, createPlannerTicketFile } from "./planner-api";

export const createResourceStreamFixture = async (request: APIRequestContext, baseURL: string) => {
  const parent = process.env.E2E_FIXTURE_ROOT ?? tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "resource-budget-"));
  const source = writeCommandStreamExtension(root);
  const projects: { id: string }[] = [];
  for (const name of ["Stream source", "Stream destination"]) {
    const response = await request.post("/v1/projects", { data: folderProjectInput({ name }) });
    expect(response.ok()).toBe(true);
    projects.push(await response.json());
  }
  const projectId = projects[0]!.id;
  const enabled = await request.post(`/v1/projects/${projectId}/extensions/installed/stream-fixture/enable`, {
    data: {
      displayName: "Stream fixture",
      extensionId: "test.stream-fixture",
      manifest: { id: "test.stream-fixture", name: "stream-fixture" },
      name: "stream-fixture",
      sourceHash: "resource-budget",
      sourceKind: "local_path",
      sourcePath: source,
      sourceRef: null,
      version: "1.0.0",
    },
  });
  expect(enabled.ok(), await enabled.text()).toBe(true);
  const tickets = [];
  const targets = [];
  for (let index = 0; index < 5; index++) {
    const ticket = await createPlannerTicket(request, baseURL, projectId, {
      content: `# Budget ticket ${index}\nBody ${index}`,
    });
    tickets.push(ticket);
    targets.push({
      fileRendererId: "pstdio.pstdio-planner.view.ticket-editor",
      resource: { type: "ticket", id: ticket.id },
    });
  }
  for (let index = 0; index < 3; index++) {
    const file = await createPlannerTicketFile(request, baseURL, projectId, tickets[0]!.id, {
      name: `file-${index}.md`,
      content: `# File ${index}\nRetained file ${index}`,
    });
    targets.push({
      fileRendererId: "pstdio.pstdio-planner.view.ticket-editor",
      resource: { type: "ticket", id: tickets[0]!.id, metadata: { documentId: file.id } },
    });
  }
  const destination = await createPlannerTicket(request, baseURL, projects[1]!.id, {
    content: "# Destination\nDestination content",
  });
  const sessionResponse = await request.post("/v1/sessions", {
    data: {
      project_id: projectId,
      title: "Budget session",
      prompt: "Budget session __fake_hold__",
      agent: "pstdio.workbench-fixture.harness.fake",
    },
  });
  expect(sessionResponse.ok()).toBe(true);
  const session = await sessionResponse.json();
  const clientScript = join(root, "resource-client.js");
  execFileSync(
    "bun",
    [
      "build",
      join(import.meta.dirname, "resource-stream-client.ts"),
      "--target=browser",
      "--format=esm",
      "--outfile",
      clientScript,
    ],
    { stdio: "pipe" },
  );
  const script = readFileSync(clientScript, "utf8");
  return {
    projectId,
    projects,
    tickets,
    targets,
    destination,
    session,
    script,
    cleanup: async (context = request) => {
      for (const project of projects) await context.delete(`/v1/projects/${project.id}`);
      rmSync(root, { recursive: true, force: true });
    },
  };
};
