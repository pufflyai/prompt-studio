import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessStartInput } from "pstdio-api-contracts";
import { createApp } from "../../../app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const PARAM_AGENT_ID = testHarnessId("param-agent");

const startParamAgent = mock((_ctx: unknown, _input: HarnessStartInput) => ({
  agentSessionId: `param-${crypto.randomUUID()}`,
  done: Promise.resolve({ status: "completed" as const }),
  stop: () => {},
}));

let handle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;

const waitForStart = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (startParamAgent.mock.calls.length > 0) return;
    await Bun.sleep(10);
  }
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-create-session-harness-params-test-"));
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("param-agent", {
        provider: {
          params: {
            effort: {
              type: "select",
              defaultValue: "low",
              options: [
                { label: "Low", value: "low" },
                { label: "High", value: "high" },
              ],
            },
            dryRun: { type: "boolean", defaultValue: false },
          },
          start: startParamAgent,
        },
      }),
    ]),
  });
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/sessions harness params", () => {
  test("passes defaulted and overridden harness params to the selected harness start input", async () => {
    startParamAgent.mockClear();
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Harness Params Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Harness params session",
        prompt: "Run task",
        agent: PARAM_AGENT_ID,
        params: { dryRun: true },
      }),
    });

    expect(createRes.status).toBe(201);
    await waitForStart();

    expect(startParamAgent).toHaveBeenCalledTimes(1);
    expect(startParamAgent.mock.calls[0]?.[1].params).toEqual({ effort: "low", dryRun: true });
  });

  test("uses project harness param defaults when no run override is submitted", async () => {
    startParamAgent.mockClear();
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Harness Params Defaults Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const defaultsRes = await handle.app.request(
      `/v1/projects/${project.id}/harnesses/${encodeURIComponent(PARAM_AGENT_ID)}/params`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ params: { effort: "high", dryRun: true } }),
      },
    );
    expect(defaultsRes.status).toBe(200);

    const createRes = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Harness params default session",
        prompt: "Run task",
        agent: PARAM_AGENT_ID,
      }),
    });

    expect(createRes.status).toBe(201);
    await waitForStart();

    expect(startParamAgent).toHaveBeenCalledTimes(1);
    expect(startParamAgent.mock.calls[0]?.[1].params).toEqual({ effort: "high", dryRun: true });
  });

  test("ignores stale stored defaults that are no longer declared by the harness", async () => {
    startParamAgent.mockClear();
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Stale Harness Params Defaults Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    await handle.deps.extensionSettingsDBService.setValue({
      owner_type: "extension_instance",
      owner_id: `${project.id}:${PARAM_AGENT_ID}`,
      extension_id: "pstdio.harness-params",
      key: "defaults",
      value_json: { old_param: "legacy", effort: "high" },
    });

    const createRes = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Stale harness params default session",
        prompt: "Run task",
        agent: PARAM_AGENT_ID,
      }),
    });

    expect(createRes.status).toBe(201);
    await waitForStart();

    expect(startParamAgent).toHaveBeenCalledTimes(1);
    expect(startParamAgent.mock.calls[0]?.[1].params).toEqual({ effort: "high", dryRun: false });
  });

  test("returns 400 and does not start the harness when params fail schema validation", async () => {
    startParamAgent.mockClear();
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Invalid Harness Params Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const createRes = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Invalid harness params session",
        prompt: "Run task",
        agent: PARAM_AGENT_ID,
        params: { effort: "medium" },
      }),
    });

    expect(createRes.status).toBe(400);
    expect(await createRes.json()).toEqual({
      error: expect.stringContaining('Harness param "effort"'),
    });
    expect(startParamAgent).not.toHaveBeenCalled();
  });
});
