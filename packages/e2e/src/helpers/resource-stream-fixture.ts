import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type APIRequestContext, expect } from "@playwright/test";
import { installProjectFixture } from "../scripts/fixture-test";
import { writeCommandStreamExtension } from "./command-stream-extension";
import { folderProjectInput } from "./folder-project";
import { createPlannerTicket, createPlannerTicketFile } from "./planner-api";

export const createResourceStreamFixture = async (request: APIRequestContext, baseURL: string) => {
  const parent = process.env.E2E_FIXTURE_ROOT ?? process.env.E2E_HOME ?? tmpdir();
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "resource-budget-"));
  const created: { id: string }[] = [];
  const cleanup = async (context = request) => {
    try {
      const deletions = await Promise.allSettled(
        created.map(({ id }) => context.delete(`/v1/projects/${id}`, { failOnStatusCode: true })),
      );
      const failure = deletions.find((entry) => entry.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  };
  try {
    const source = writeCommandStreamExtension(root);
    const createProject = async (name: string): Promise<{ id: string }> => {
      const response = await request.post("/v1/projects", { data: folderProjectInput({ name }) });
      expect(response.ok()).toBe(true);
      const project = (await response.json()) as { id: string };
      created.push(project);
      return project;
    };
    const projectsPending = [createProject("Stream source"), createProject("Stream destination")] as const;
    // Keep setup from returning while a sibling request can still create a project.
    await Promise.allSettled(projectsPending);
    const [sourceProject, destinationProject] = await Promise.all(projectsPending);
    const projects = [sourceProject, destinationProject];
    const projectId = sourceProject.id;
    await installProjectFixture(request, "harness", projectId, new URL(baseURL).origin);
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
        fileRendererId: "pstdio.planner.view.ticket-editor",
        resource: { type: "ticket", id: ticket.id },
      });
    }
    for (let index = 0; index < 3; index++) {
      const file = await createPlannerTicketFile(request, baseURL, projectId, tickets[0]!.id, {
        name: `file-${index}.md`,
        content: `# File ${index}\nRetained file ${index}`,
      });
      targets.push({
        fileRendererId: "pstdio.planner.view.ticket-editor",
        resource: { type: "ticket", id: tickets[0]!.id, metadata: { documentId: file.id } },
      });
    }
    const destination = await createPlannerTicket(request, baseURL, destinationProject.id, {
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
        join(import.meta.dirname, "resource-stream-client.fixture.ts"),
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
      cleanup,
    };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Resource-stream setup and cleanup failed");
    }
    throw error;
  }
};
