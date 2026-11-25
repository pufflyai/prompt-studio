import { expect, test } from "bun:test";
import { createDb, createExtensionConnectionsDBService, createProjectsDBService } from "pstdio-db";
import { createMemoryConnectionSecretStore } from "./connection-secret-store";
import { createExtensionConnectionService, createExtensionConnectionsApi } from "./extension-connection-service";
import { contribution } from "./extension-connection-service.test-fixture";

test("one global connection serves new projects and shares updates and revocation", async () => {
  const store = await createDb({ path: ":memory:" });
  const secrets = createMemoryConnectionSecretStore();
  const received: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      received.push(request.headers.get("authorization") ?? "");
      return Response.json({ ok: true });
    },
  });
  try {
    const projects = createProjectsDBService(store.db);
    const db = createExtensionConnectionsDBService(store.db);
    for (const id of ["first", "second", "project-only"]) await projects.create({ id, name: id });
    const deps = {
      connectionsDBService: db,
      secretStore: secrets,
      getContribution: async ({ projectId }: { projectId: string }) =>
        projectId === "project-only" ? contribution : { ...contribution, scope: "global" as const },
    };
    const service = createExtensionConnectionService(deps);
    const input = { projectId: "first", extensionId: "pstdio.remote", connectionId: contribution.id };
    await expect(
      service.configure({
        ...input,
        baseUrl: server.url.origin,
        secret: "must-stay-project-only",
        credentialScope: "project",
      }),
    ).rejects.toThrow("A global connection requires a shared credential");
    expect(await secrets.listRefs()).toEqual([]);
    await service.configure({ ...input, baseUrl: server.url.origin, secret: "shared-credential" });
    const api = (projectId: string) =>
      createExtensionConnectionsApi(service, { projectId, extensionId: input.extensionId });
    expect((await api("second").request(contribution.id, { method: "GET", path: "/v1/workspaces" })).status).toBe(200);
    expect(received).toEqual(["Bearer shared-credential"]);
    await expect(service.remove({ ...input, credentialScope: "project" })).rejects.toThrow(
      "A global connection requires a shared credential",
    );
    expect((await service.list("second"))[0]).toMatchObject({
      scope: "global",
      configured: true,
      lastCheck: { ok: true, status: 200 },
    });
    await expect(
      api("project-only").request(contribution.id, { method: "GET", path: "/v1/workspaces" }),
    ).rejects.toThrow("not configured");
    expect(await service.list("project-only")).toEqual([]);
    const otherOrigin = "https://other.example.test";
    await service.configure({
      ...input,
      projectId: "project-only",
      baseUrl: otherOrigin,
      secret: "separate-origin-credential",
    });
    await service.remove({ ...input, credentialScope: "all-projects", origin: otherOrigin });
    expect((await service.list("second"))[0]).toMatchObject({ configured: true });
    expect((await service.list("project-only"))[0]).toMatchObject({ configured: false });
    expect(await secrets.listRefs()).toHaveLength(1);
    await service.configure({
      ...input,
      projectId: "project-only",
      baseUrl: server.url.origin,
      secret: "project-configuration-credential",
      credentialScope: "all-projects",
    });
    await expect(
      service.remove({ ...input, credentialScope: "all-projects", origin: server.url.origin }),
    ).rejects.toThrow("more than one saved sign-in");
    expect(await secrets.listRefs()).toHaveLength(2);
    const rotated = await service.configure({
      ...input,
      projectId: "second",
      baseUrl: server.url.origin,
      secret: "rotated-credential",
    });
    expect(rotated.lastCheck).toBeNull();
    const removeSecrets = await service.prepareProjectRemoval("first");
    await projects.remove("first");
    await removeSecrets();
    await service.removeExtension("second", input.extensionId);
    await projects.create({ id: "new-project", name: "New project" });
    const reloaded = createExtensionConnectionService(deps);
    const newApi = createExtensionConnectionsApi(reloaded, {
      projectId: "new-project",
      extensionId: input.extensionId,
    });
    expect((await newApi.request(contribution.id, { method: "GET", path: "/v1/workspaces" })).status).toBe(200);
    expect(received.at(-1)).toBe("Bearer rotated-credential");
    expect(await secrets.listRefs()).toHaveLength(2);
    expect(await db.listAll()).toHaveLength(2);
    await reloaded.remove({ ...input, projectId: "new-project" });
    await expect(api("second").request(contribution.id, { method: "GET", path: "/v1/workspaces" })).rejects.toThrow(
      "not configured",
    );
    expect((await api("project-only").request(contribution.id, { method: "GET", path: "/v1/workspaces" })).status).toBe(
      200,
    );
    expect(received.at(-1)).toBe("Bearer project-configuration-credential");
    expect(await secrets.listRefs()).toHaveLength(1);
  } finally {
    server.stop(true);
    await store.close();
  }
});

test("configuring a global connection retires project copies and survives reconciliation", async () => {
  const store = await createDb({ path: ":memory:" });
  const secrets = createMemoryConnectionSecretStore();
  const db = createExtensionConnectionsDBService(store.db);
  let global = false;
  const service = createExtensionConnectionService({
    connectionsDBService: db,
    secretStore: secrets,
    getContribution: async () => ({ ...contribution, ...(global ? { scope: "global" as const } : {}) }),
    isExtensionInstalled: async (projectId) => projectId === null,
  });
  try {
    for (const id of ["first", "second"]) {
      await createProjectsDBService(store.db).create({ id, name: id });
      await service.configure({
        projectId: id,
        extensionId: "pstdio.remote",
        connectionId: contribution.id,
        baseUrl: "https://example.test",
        secret: `${id}-credential`,
        credentialScope: "project",
      });
    }
    expect(await secrets.listRefs()).toHaveLength(2);
    global = true;
    await service.configure({
      projectId: "first",
      extensionId: "pstdio.remote",
      connectionId: contribution.id,
      baseUrl: "https://example.test",
      secret: "one-global-credential",
    });
    expect(await db.listAll()).toHaveLength(1);
    expect(await db.listByProject("first")).toEqual([]);
    expect(await db.listByProject("second")).toEqual([]);
    expect(await secrets.listRefs()).toHaveLength(1);
    await service.reconcile();
    expect(await secrets.listRefs()).toHaveLength(1);
    expect((await service.list("second"))[0]?.configured).toBe(true);
  } finally {
    await store.close();
  }
});

for (const change of ["remove", "rotate"] as const) {
  test(`a late global health check cannot undo credential ${change}`, async () => {
    const store = await createDb({ path: ":memory:" });
    const secrets = createMemoryConnectionSecretStore();
    const db = createExtensionConnectionsDBService(store.db);
    const service = createExtensionConnectionService({
      connectionsDBService: db,
      secretStore: secrets,
      getContribution: async () => ({ ...contribution, scope: "global" }),
    });
    const input = { projectId: "first", extensionId: "pstdio.remote", connectionId: contribution.id };
    const key = { projectId: null, extensionId: input.extensionId, contributionId: input.connectionId };
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        expect(request.headers.get("authorization")).toBe("Bearer original-credential");
        entered.resolve();
        await release.promise;
        return Response.json({ ok: true });
      },
    });
    let pending: ReturnType<typeof service.request> | undefined;
    try {
      await createProjectsDBService(store.db).create({ id: "first", name: "First" });
      const params = { ...input, baseUrl: server.url.origin };
      await service.configure({ ...params, secret: "original-credential" });
      pending = service.request({ ...input, input: { method: "GET", path: "/v1/workspaces" } });
      await Promise.race([entered.promise, pending]);
      if (change === "remove") await service.remove(input);
      else await service.configure({ ...params, secret: "new-credential" });
      release.resolve();
      expect((await pending).status).toBe(200);
      const current = await db.get(key);
      if (change === "remove") expect(current).toBeNull();
      else {
        expect(await secrets.get(current!.secret_ref!)).toBe("new-credential");
        expect(current?.last_check_json).toBeNull();
      }
    } finally {
      release.resolve();
      await pending?.catch(() => undefined);
      server.stop(true);
      await store.close();
    }
  });
}
