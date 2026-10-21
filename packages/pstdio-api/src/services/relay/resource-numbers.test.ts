import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { startResourceNumberSync } from "./resource-numbers";

test("removing resource sync closes while access renewal is still pending", async () => {
  const app = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const renewal = Promise.withResolvers<{ token: string; expiresAt: string }>();
  const controller = new AbortController();
  const connection = startResourceNumberSync({
    deps: app.deps,
    config: {
      accountId: "account",
      workbenchId: "project",
      environmentId: "device",
      relayOrigin: "http://127.0.0.1:9",
      managerOrigin: "http://127.0.0.1:9",
      renewalGrant: "grant",
    },
    signal: controller.signal,
    access: () => {
      entered.resolve();
      return renewal.promise;
    },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await entered.promise;
    connection.close();
    const outcome = await Promise.race([
      connection.done.then(() => "closed"),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve("waiting"), 100);
      }),
    ]);
    expect(outcome).toBe("closed");
  } finally {
    clearTimeout(timer);
    renewal.resolve({ token: "unused", expiresAt: new Date().toISOString() });
    controller.abort();
    await connection.done;
    await app.close();
  }
});
