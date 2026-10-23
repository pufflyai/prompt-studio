import { strict as assert } from "node:assert";
import { createAccountManager } from "pstdio-account-manager";
import { scopeSchema } from "pstdio-sync-contracts";
import { renewFixtureAccess } from "./manager.fixture";
import { checkBuiltShutdown } from "./smoke-shutdown";

export const checkBuiltTransport = async () => {
  const saved = await Bun.file("/fixture/grant.json").json();
  const scope = scopeSchema.parse(saved.scope);
  const manager = createAccountManager(process.env.MANAGER_DATABASE_URL!);
  const access = await renewFixtureAccess(saved.token, scope.workbenchId);
  const child = Bun.spawn([process.execPath, "/app/transport-client-smoke.js"], {
    env: {
      PATH: process.env.PATH!,
      HOME: process.env.HOME!,
      RELAY_URL: process.env.RELAY_URL!,
      SMOKE_ACCOUNT_ID: scope.accountId,
      SMOKE_WORKBENCH_ID: scope.workbenchId,
      SMOKE_ENVIRONMENT_ID: saved.environmentId,
      SMOKE_ENVIRONMENT_TOKEN: access.token,
    },
    stdout: "pipe",
    stderr: "inherit",
  });
  try {
    let ready = false;
    let pending = "";
    for await (const chunk of child.stdout.pipeThrough(new TextDecoderStream())) {
      pending += chunk;
      let boundary = pending.indexOf("\n");
      while (boundary >= 0) {
        const line = pending.slice(0, boundary);
        pending = pending.slice(boundary + 1);
        process.stdout.write(`${line}\n`);
        if (!ready && line === "READY_FOR_REVOCATION") {
          ready = true;
          await manager.removeDevice({ accountId: scope.accountId, deviceId: saved.environmentId });
          await assert.rejects(renewFixtureAccess(saved.token, scope.workbenchId));
        }
        boundary = pending.indexOf("\n");
      }
    }
    assert.equal(await child.exited, 0);
    assert.equal(ready, true);
    await checkBuiltShutdown(manager, scope);
  } finally {
    child.kill();
    await child.exited;
    await manager.close();
  }
};
