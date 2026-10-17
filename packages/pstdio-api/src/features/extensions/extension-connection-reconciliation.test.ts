import { expect, test } from "bun:test";
import { createMemoryConnectionSecretStore } from "./connection-secret-store";
import { createExtensionConnectionService } from "./extension-connection-service";
import { connection, contribution } from "./extension-connection-service.test-fixture";

test("background reconciliation preserves credentials configured after the app opens", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const secrets = createMemoryConnectionSecretStore();
  let stored: typeof connection | null = null;
  const service = createExtensionConnectionService({
    connectionsDBService: {
      listAll: async () => (stored ? [stored] : []),
      get: async () => stored,
      upsert: async (input: { secretRef: string }) => {
        stored = { ...connection, secret_ref: input.secretRef };
        return stored;
      },
    } as never,
    secretStore: {
      ...secrets,
      listRefs: async () => {
        entered.resolve();
        await release.promise;
        return secrets.listRefs();
      },
    },
    getContribution: async () => contribution,
  });

  const reconciling = service.reconcile();
  await entered.promise;
  const configuring = service.configure({
    projectId: "project-1",
    extensionId: "pstdio.remote",
    connectionId: "control-plane",
    baseUrl: "https://control.example.test/",
    secret: "new-credential",
  });
  try {
    await Bun.sleep(0);
    release.resolve();
    await Promise.all([reconciling, configuring]);
    const [ref] = await secrets.listRefs();
    expect(ref).toBeDefined();
    expect(await secrets.get(ref!)).toBe("new-credential");
  } finally {
    release.resolve();
    await Promise.allSettled([reconciling, configuring]);
  }
});
