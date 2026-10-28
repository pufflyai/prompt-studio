import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";

setupPackagedSmokeTests();

test("starts independent packaged hosts concurrently", async () => {
  const roots = ["first", "second"].map((name) => mkdtempSync(join(tmpdir(), `pstdio-host-${name}-`)));
  const children: ChildProcess[] = [];
  const workbenchId = crypto.randomUUID();
  const environments: string[] = [];
  try {
    const outcomes = await Promise.allSettled(roots.map((root) => startPackagedServe(root)));
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") children.push(outcome.value.child);
    }
    for (const [index, outcome] of outcomes.entries()) {
      if (outcome.status === "rejected") throw outcome.reason;
      const host = outcome.value;
      const response = await fetch(`${host.baseUrl}/v1/projects`, {
        headers: runtimeAuthorization(host.descriptor),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
      const identityResponse = await fetch(`${host.baseUrl}/v1/environment`, {
        headers: runtimeAuthorization(host.descriptor),
      });
      expect(identityResponse.status).toBe(200);
      const identity = await identityResponse.json();
      environments.push(identity.environmentId);
      const path = join(roots[index]!, "workbench");
      mkdirSync(path);
      const bindingResponse = await fetch(`${host.baseUrl}/v1/projects/${workbenchId}/environment-binding`, {
        method: "PUT",
        headers: { ...runtimeAuthorization(host.descriptor), "content-type": "application/json" },
        body: JSON.stringify({
          ...identity,
          name: "Shared workbench",
          initial_workspace: { provider_id: "pstdio.root", params: { path } },
        }),
      });
      expect(bindingResponse.status).toBe(201);
      expect(await bindingResponse.json()).toMatchObject({
        ...identity,
        workbenchId,
        workspace: { project_id: workbenchId },
      });
    }
    expect(environments[0]).not.toBe(environments[1]);
  } finally {
    await Promise.all(children.map(stopProcess));
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});
