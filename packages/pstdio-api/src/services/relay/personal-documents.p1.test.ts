import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createPersonalContext } from "./personal-context";
import { createPersonalDocuments } from "./personal-documents";

test("the personal space remains unavailable until rotated document identifiers finish preparing", async () => {
  const app = await createTestApp();
  let generation = 1;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      const keys = [{ generation: 1, secret: "B".repeat(43) }];
      if (generation === 2) keys.push({ generation: 2, secret: "C".repeat(43) });
      return Response.json({ project: keys, personal: keys });
    },
  });
  const controller = new AbortController();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const originalSign = crypto.subtle.sign;
  let preparing: Promise<unknown> | undefined;
  let documents: ReturnType<typeof createPersonalDocuments> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Renewal fence" });
    const config = {
      accountId: "bob",
      environmentId: "device",
      workbenchId: project.id,
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      renewalGrant: "grant",
    };
    documents = createPersonalDocuments({
      config,
      context: createPersonalContext(config, app.deps),
      signal: controller.signal,
      access: async () => ({ token: "device", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
      subscribe: () => {},
    });
    await documents.prepare(controller.signal);
    expect(documents.space?.generation).toBe(1);
    generation = 2;
    documents.invalidateKeys();
    expect(documents.space).toBeUndefined();
    // Only pause completion of real HMAC signing; neither its input nor its result is substituted.
    crypto.subtle.sign = async function (...args: Parameters<SubtleCrypto["sign"]>) {
      const name = new TextDecoder().decode(args[2] as Uint8Array);
      if (name === JSON.stringify(["pstdio.personal-history", "records-v3"])) {
        entered.resolve();
        await release.promise;
      }
      return originalSign.apply(this, args);
    };
    preparing = documents.prepare(controller.signal);
    await entered.promise;
    expect(documents.space).toBeUndefined();
    release.resolve();
    await preparing;
    expect(documents.space?.generation).toBe(2);
  } finally {
    release.resolve();
    await preparing;
    crypto.subtle.sign = originalSign;
    controller.abort();
    documents?.close();
    await manager.stop(true);
    await app.close();
  }
});
