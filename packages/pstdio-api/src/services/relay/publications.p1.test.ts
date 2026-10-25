import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { startPublishedExtensions } from "./publications";

test("extension set discovery closes while access renewal is pending", async () => {
  const app = await createTestApp();
  const project = await app.deps.projectService.create({ name: "Pending access" });
  const entered = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const controller = new AbortController();
  const connection = startPublishedExtensions({
    deps: app.deps,
    signal: controller.signal,
    config: {
      accountId: "account",
      workbenchId: project.id,
      environmentId: "device",
      relayOrigin: "http://127.0.0.1:9",
      managerOrigin: "http://127.0.0.1:9",
      renewalGrant: "grant",
    },
    access: () => {
      entered.resolve();
      return pending.promise;
    },
  });
  try {
    await entered.promise;
    connection.close();
    await connection.done;
    expect((await connection.status()).connected).toBe(false);
  } finally {
    pending.resolve({ token: "unused", expiresAt: new Date().toISOString() });
    controller.abort();
    await connection.done;
    await app.close();
  }
});
