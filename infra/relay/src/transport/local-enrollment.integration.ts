import { afterAll, beforeAll, expect, test } from "bun:test";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

test("re-enrolling the local demo preserves other workbench renewal grants", async () => {
  const context = await fixture.context();
  try {
    await context.manager.provision({
      requestId: "local-fixture-account",
      accountId: "built-network-account",
      owner: { issuer: "https://accounts.google.com", subject: "owned-local-fixture" },
    });
    const notes = await context.manager.register({
      requestId: "notes-grant",
      accountId: "built-network-account",
      workbenchId: context.scope.workbenchId,
      environmentId: context.environmentId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const enroll = () => {
      const child = Bun.spawn(
        [process.execPath, new URL("../../scripts/enroll-local.fixture.ts", import.meta.url).pathname],
        {
          env: { ...process.env, DATABASE_URL: fixture.managerDatabaseUrl },
          stdin: new Blob([JSON.stringify({ environmentId: context.environmentId, workbenchId: "demo-workbench" })]),
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      return Promise.all([child.exited, new Response(child.stdout).json(), new Response(child.stderr).text()]);
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const [status, grant, errors] = await enroll();
      expect(errors).toBe("");
      expect(status).toBe(0);
      expect(await context.manager.authorize((grant as { token: string }).token, "demo-workbench")).not.toBeNull();
      const renewed = await context.managerHandler(
        new Request("https://manager.fixture.test/v1/environment-access", {
          method: "POST",
          headers: { authorization: `Bearer ${notes.token}`, "content-type": "application/json" },
          body: JSON.stringify({ workbenchId: context.scope.workbenchId }),
        }),
      );
      expect(renewed.status).toBe(200);
      await renewed.body?.cancel();
    }
  } finally {
    await context.close();
  }
});
