import { expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
import { folderProjectInput } from "../helpers/folder-project";
import { logTestPhase } from "../scripts/log-test-phase";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export interface PackagedPlanner {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  metadata: WorkbenchExtensionMetadata;
}

// Run a Planner command through the packaged HTTP API and return its value.
export const commandRunner =
  (input: { baseUrl: string; projectId: string; headers: Record<string, string> }) =>
  async (command: string, params: unknown) => {
    const { baseUrl, projectId, headers } = input;
    const started = Date.now();
    logTestPhase(`Planner command ${command}: start`);
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
    logTestPhase(`Planner command ${command}: complete (${Date.now() - started}ms)`);
    return body.outcome.value;
  };

export async function withPackagedPlanner(check: (input: PackagedPlanner) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), "pstdio-packaged-planner-"));
  let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  const started = Date.now();
  const phase = (name: string) => logTestPhase(`Planner fixture ${name} (${Date.now() - started}ms)`);
  try {
    phase("runtime start");
    host = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions(
        "workbench-fixture",
        "extension-lab",
        "pstdio-artifacts",
        "pstdio-planner",
        "pstdio-reports",
      ),
      PSTDIO_EXTENSION_WEBVIEW_BUILDS: "0",
    });
    phase("runtime ready");
    const headers = runtimeAuthorization(host.descriptor);
    phase("project create start");
    const response = await fetch(`${host.baseUrl}/v1/projects`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "packaged-workspace-action-project" })),
    });
    expect(response.status).toBe(201);
    const project = (await response.json()) as { id: string };
    phase("project create complete");
    const metadata = await fetch(`${host.baseUrl}/v1/projects/${project.id}/extensions/ui`, { headers });
    expect(metadata.status).toBe(200);
    phase("metadata complete");
    await check({ baseUrl: host.baseUrl, projectId: project.id, headers, metadata: await metadata.json() });
    phase("checks complete");
  } finally {
    phase("cleanup start");
    if (host) await stopProcess(host.child);
    rmSync(root, { recursive: true, force: true });
    phase("cleanup complete");
  }
}

// Planner assigns no workflow meaning to status names, so packaged projects choose their seeded statuses by ID.
export async function configurePlannerWorkflow(execute: ReturnType<typeof commandRunner>) {
  const { statuses } = (await execute("ticket-status.read", {})) as { statuses: { id: string; name: string }[] };
  const statusId = (name: string) => statuses.find((status) => status.name === name)!.id;
  const selections = {
    completedStatusIds: [statusId("Done")],
    blockedStatusIds: [statusId("Blocked")],
    activeStatusIds: [statusId("In Progress")],
    mergeTargetStatusId: statusId("Done"),
  };
  await execute("workflow-statuses.save", { selections });
  return { selections, statusId };
}
