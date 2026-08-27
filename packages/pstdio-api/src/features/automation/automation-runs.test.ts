import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createTestApp } from "../../test-utils/create-test-app";
import type { AppBindings } from "../../types";
import {
  BLOCKING_COMMAND_ID,
  COMMAND_ID,
  INSPECT_COMMAND_ID,
  issueAutomationToken,
  LARGE_ERROR_COMMAND_ID,
  LARGE_RESULT_COMMAND_ID,
  PROVISION_COMMAND_ID,
  RUNTIME_TOKEN,
  requestWithToken,
  writeAutomationExtension,
} from "./automation-runs.fixture";

let app: OpenAPIHono<AppBindings>;
let appDeps: Awaited<ReturnType<typeof createTestApp>>["deps"];
let closeApp: () => Promise<void>;
let projectId: string;
let tempRoot: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

const runtimeRequest = (path: string, init: RequestInit = {}) => requestWithToken(app, RUNTIME_TOKEN, path, init);

beforeEach(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-automation-runs-test-"));
  previousPstdioHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";

  const created = await createTestApp({
    automationRunsPerMinute: 1,
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    host: { kind: "standalone", token: RUNTIME_TOKEN },
  });
  app = created.app;
  appDeps = created.deps;
  closeApp = created.close;

  const projectResponse = await runtimeRequest("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Automation Project" }),
  });
  projectId = (await projectResponse.json()).id;
  const sourcePath = writeAutomationExtension(tempRoot);
  const enableResponse = await runtimeRequest(`/v1/projects/${projectId}/extensions/installed/automation-test/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Automation Test",
      extensionId: "pstdio.automation-test",
      manifest: { id: "pstdio.automation-test", name: "automation-test" },
      name: "automation-test",
      sourceHash: null,
      sourceKind: "local_path",
      sourcePath,
      sourceRef: null,
      version: null,
    }),
  });
  expect(enableResponse.status).toBe(200);
});

afterEach(async () => {
  await closeApp();
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  if (previousDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  rmSync(tempRoot, { recursive: true, force: true });
});

const issueToken = (commandScopes = [COMMAND_ID]) => issueAutomationToken(runtimeRequest, projectId, commandScopes);

const machineRequest = (token: string, path: string, init: RequestInit = {}) =>
  requestWithToken(app, token, path, init);

describe("automation runs", () => {
  test("stores one run for idempotent retries and executes the opted-in command once", async () => {
    const { token } = await issueToken();
    const path = `/v1/projects/${projectId}/automation-runs`;
    const request = (amount: number) =>
      machineRequest(token, path, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "notion-page-1" },
        body: JSON.stringify({ commandId: COMMAND_ID, input: { params: { amount } } }),
      });

    const first = await request(2);
    expect(first.status).toBe(202);
    const firstRun = await first.json();

    const retry = await request(2);
    expect(retry.status).toBe(202);
    expect((await retry.json()).id).toBe(firstRun.id);

    const conflict = await request(3);
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).code).toBe("idempotency_conflict");

    let completed: { status: string; result?: unknown } = firstRun;
    for (let attempt = 0; attempt < 50 && completed.status !== "succeeded"; attempt += 1) {
      await Bun.sleep(10);
      const response = await machineRequest(token, `${path}/${firstRun.id}`);
      completed = await response.json();
    }
    expect(completed).toMatchObject({ status: "succeeded", result: { count: 2 } });
    const activity = await appDeps.activityEventsService.listByProject({
      projectId,
      resourceType: "automation_run",
      limit: 10,
    });
    expect(activity.events.map((event) => event.event_type)).toEqual(
      expect.arrayContaining(["automation.queued", "automation.running", "automation.succeeded"]),
    );
    expect(JSON.stringify(activity.events)).not.toContain("notion-page-1");
  });

  test("rejects machine credentials on unrelated routes", async () => {
    const { token } = await issueToken();

    const response = await machineRequest(token, `/v1/projects/${projectId}`);

    expect(response.status).toBe(401);
    const deniedActivity = await appDeps.activityEventsService.listByProject({
      projectId,
      resourceType: "automation_principal",
      eventType: "automation.route_denied",
      limit: 10,
    });
    expect(deniedActivity.events).toHaveLength(1);
    expect(JSON.stringify(deniedActivity.events)).not.toContain(token);
  });

  test("limits new runs without blocking an idempotent retry", async () => {
    const { token } = await issueToken();
    const path = `/v1/projects/${projectId}/automation-runs`;
    const request = (key: string) =>
      machineRequest(token, path, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ commandId: COMMAND_ID, input: { params: { amount: 1 } } }),
      });

    const first = await request("rate-limit-1");
    expect(first.status).toBe(202);
    const retry = await request("rate-limit-1");
    expect(retry.status).toBe(202);

    const limited = await request("rate-limit-2");
    expect(limited.status).toBe(429);
    expect((await limited.json()).code).toBe("automation_rate_limited");
  });

  test("admits only one concurrent run at the rate boundary", async () => {
    const { token } = await issueToken();
    const path = `/v1/projects/${projectId}/automation-runs`;
    const request = (key: string) =>
      machineRequest(token, path, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ commandId: COMMAND_ID, input: { params: { amount: 1 } } }),
      });

    const responses = await Promise.all([request("concurrent-rate-1"), request("concurrent-rate-2")]);

    expect(responses.map((response) => response.status).sort()).toEqual([202, 429]);
  });

  test("rejects automation input above the UTF-8 byte limit", async () => {
    const { token } = await issueToken();
    const response = await machineRequest(token, `/v1/projects/${projectId}/automation-runs`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "oversized-input" },
      body: JSON.stringify({
        commandId: COMMAND_ID,
        input: { params: { amount: 1 }, metadata: { payload: "å".repeat(33_000) } },
      }),
    });

    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("invalid_automation_input");
  });

  test("fails a command result above the UTF-8 byte limit without storing it", async () => {
    const { token } = await issueToken([LARGE_RESULT_COMMAND_ID]);
    const path = `/v1/projects/${projectId}/automation-runs`;
    const createdResponse = await machineRequest(token, path, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "oversized-result" },
      body: JSON.stringify({ commandId: LARGE_RESULT_COMMAND_ID, input: { params: {} } }),
    });
    const created = await createdResponse.json();

    let completed = created;
    for (let attempt = 0; attempt < 50 && completed.status !== "failed"; attempt += 1) {
      await Bun.sleep(10);
      completed = await (await machineRequest(token, `${path}/${created.id}`)).json();
    }

    expect(completed).toMatchObject({ status: "failed", result: null });
    expect(JSON.stringify(completed).length).toBeLessThan(2_000);
  });

  test("replaces an oversized command error with a bounded public error", async () => {
    const { token } = await issueToken([LARGE_ERROR_COMMAND_ID]);
    const path = `/v1/projects/${projectId}/automation-runs`;
    const createdResponse = await machineRequest(token, path, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "oversized-error" },
      body: JSON.stringify({ commandId: LARGE_ERROR_COMMAND_ID, input: { params: {} } }),
    });
    const created = await createdResponse.json();

    let completed = created;
    for (let attempt = 0; attempt < 50 && completed.status !== "failed"; attempt += 1) {
      await Bun.sleep(10);
      completed = await (await machineRequest(token, `${path}/${created.id}`)).json();
    }

    expect(completed).toMatchObject({
      status: "failed",
      error: { code: "command_error_too_large", retryable: false },
    });
    expect(JSON.stringify(completed).length).toBeLessThan(2_000);
  });
});

describe("automation run cancellation and credentials", () => {
  test("waits for a running command to acknowledge cancellation before marking it cancelled", async () => {
    const { token } = await issueToken([BLOCKING_COMMAND_ID]);
    const path = `/v1/projects/${projectId}/automation-runs`;
    const createdResponse = await machineRequest(token, path, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "cancel-blocked-command" },
      body: JSON.stringify({ commandId: BLOCKING_COMMAND_ID, input: { params: {} } }),
    });
    const created = await createdResponse.json();

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const statusResponse = await machineRequest(token, `${path}/${created.id}`);
      if ((await statusResponse.json()).status === "running") break;
      await Bun.sleep(10);
    }

    const cancelledResponse = await machineRequest(token, `${path}/${created.id}/cancel`, { method: "POST" });
    expect(cancelledResponse.status).toBe(200);
    expect(await cancelledResponse.json()).toMatchObject({ status: "cancelled" });

    const inspectedResponse = await runtimeRequest(
      `/v1/projects/${projectId}/extensions/commands/${INSPECT_COMMAND_ID}/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "api", params: {} }),
      },
    );
    expect(await inspectedResponse.json()).toMatchObject({ outcome: { value: { cancelledSideEffect: false } } });
  });

  test("cancels remote provisioning before a session is created and cleans up an accepted workspace", async () => {
    const { token } = await issueToken([PROVISION_COMMAND_ID]);
    const path = `/v1/projects/${projectId}/automation-runs`;
    const createdResponse = await machineRequest(token, path, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "cancel-remote-provisioning" },
      body: JSON.stringify({ commandId: PROVISION_COMMAND_ID, input: { params: {} } }),
    });
    const created = await createdResponse.json();

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const inspected = await runtimeRequest(
        `/v1/projects/${projectId}/extensions/commands/${INSPECT_COMMAND_ID}/execute`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: "api", params: {} }),
        },
      );
      const body = await inspected.json();
      if (body.outcome?.value?.providerCreateStarted) break;
      await Bun.sleep(10);
    }

    const cancelledResponse = await machineRequest(token, `${path}/${created.id}/cancel`, { method: "POST" });
    expect(cancelledResponse.status).toBe(200);
    expect(await cancelledResponse.json()).toMatchObject({ status: "cancelled" });

    const inspectedResponse = await runtimeRequest(
      `/v1/projects/${projectId}/extensions/commands/${INSPECT_COMMAND_ID}/execute`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "api", params: {} }),
      },
    );
    expect(await inspectedResponse.json()).toMatchObject({
      outcome: { value: { providerCancelCount: 1, sessionCount: 0 } },
    });
  });

  test("never lists raw credentials and rejects revoked or out-of-scope use", async () => {
    const { token } = await issueToken();
    const listedResponse = await runtimeRequest(`/v1/auth/tokens?projectId=${projectId}`);
    const listed = await listedResponse.json();
    expect(listedResponse.status).toBe(200);
    expect(JSON.stringify(listed)).not.toContain(token);
    expect(listed.tokens[0]).not.toHaveProperty("token");

    const path = `/v1/projects/${projectId}/automation-runs`;
    const denied = await machineRequest(token, path, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "private-command" },
      body: JSON.stringify({
        commandId: "pstdio.automation-test.command.private",
        input: { params: {} },
      }),
    });
    expect(denied.status).toBe(403);
    expect((await denied.json()).code).toBe("automation_scope_denied");
    const deniedActivity = await appDeps.activityEventsService.listByProject({
      projectId,
      resourceType: "automation_principal",
      eventType: "automation.scope_denied",
      limit: 10,
    });
    expect(deniedActivity.events).toHaveLength(1);

    const tokenId = listed.tokens[0].id;
    expect((await runtimeRequest(`/v1/auth/tokens/${tokenId}`, { method: "DELETE" })).status).toBe(204);
    const revoked = await machineRequest(token, path, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "revoked-token" },
      body: JSON.stringify({ commandId: COMMAND_ID, input: { params: { amount: 1 } } }),
    });
    expect(revoked.status).toBe(401);
  });
});
