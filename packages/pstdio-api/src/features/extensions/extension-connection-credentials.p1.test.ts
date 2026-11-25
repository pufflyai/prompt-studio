import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import {
  createDb,
  createExtensionConnectionsDBService,
  createProjectsDBService,
  preferences,
  projects,
} from "pstdio-db";
import { createMemoryConnectionSecretStore } from "./connection-secret-store";
import { createExtensionConnectionService, type ExtensionConnectionServiceDeps } from "./extension-connection-service";
import { contribution } from "./extension-connection-service.test-fixture";

const setup = async (isExtensionInstalled?: ExtensionConnectionServiceDeps["isExtensionInstalled"]) => {
  const store = await createDb({ path: ":memory:" });
  for (const id of ["first", "second"]) await createProjectsDBService(store.db).create({ id, name: id });
  const received: string[] = [];
  let status = 200;
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      received.push(request.headers.get("authorization")!);
      return Response.json({ ok: status === 200 }, { status });
    },
  });
  const secrets = createMemoryConnectionSecretStore();
  const connections = createExtensionConnectionService({
    connectionsDBService: createExtensionConnectionsDBService(store.db),
    secretStore: secrets,
    getContribution: async () => contribution,
    isExtensionInstalled,
  });
  const key = (projectId: string) => ({
    projectId,
    extensionId: "example.shared-credential",
    connectionId: contribution.id,
  });
  const configure = (projectId: string, secret?: string) =>
    connections.configure({ ...key(projectId), baseUrl: server.url.origin, secret });
  const request = (projectId: string) =>
    connections.request({ ...key(projectId), input: { method: "GET", path: "/v1/workspaces" } });
  return {
    ...store,
    server,
    secrets,
    connections,
    key,
    configure,
    request,
    received,
    setStatus: (next: number) => {
      status = next;
    },
    cleanup: async () => {
      server.stop(true);
      await store.close();
    },
  };
};

test("one device sign-in serves matching providers in multiple projects without exposing credentials in project preferences", async () => {
  const f = await setup();
  try {
    await f.configure("first", "global-canary");
    const configured = await f.configure("second");
    expect(configured.configured).toBe(true);
    await f.request("second");
    expect(f.received.at(-1)).toBe("Bearer global-canary");
    expect(JSON.stringify(await f.connections.list("second"))).not.toContain("global-canary");
    const rows = await f.db.select().from(preferences);
    expect(JSON.stringify(rows)).not.toContain("global-canary");
    expect(JSON.stringify(rows)).not.toContain("secret_ref");
    expect(JSON.stringify(rows)).not.toContain("secretRef");
    expect(await f.secrets.listRefs()).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});

test("deleting one project preserves the device sign-in used by another project", async () => {
  const f = await setup();
  try {
    await f.configure("first", "retained-canary");
    await f.configure("second");
    const cleanup = await f.connections.prepareProjectRemoval("first");
    await f.db.delete(projects).where(eq(projects.id, "first"));
    await cleanup();
    await f.connections.reconcile();
    await f.request("second");
    expect(f.received.at(-1)).toBe("Bearer retained-canary");
    expect(await f.secrets.listRefs()).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});

test("a device credential cannot be reused for a different provider origin", async () => {
  const f = await setup();
  try {
    await f.configure("first", "origin-canary");
    await expect(
      f.connections.configure({ ...f.key("second"), baseUrl: "https://other-provider.example.test" }),
    ).rejects.toThrow();
    expect(f.received).toHaveLength(0);
    await f.request("first");
    expect(f.received.at(-1)).toBe("Bearer origin-canary");
  } finally {
    await f.cleanup();
  }
});

test("project-specific credentials override the device sign-in until explicitly switched or removed", async () => {
  const f = await setup();
  try {
    await f.configure("first", "global-canary");
    await f.connections.configure({
      ...f.key("second"),
      baseUrl: f.server.url.origin,
      secret: "project-canary",
      credentialScope: "project",
    });
    await f.request("first");
    expect(f.received.at(-1)).toBe("Bearer global-canary");
    await f.request("second");
    expect(f.received.at(-1)).toBe("Bearer project-canary");
    await f.connections.configure({
      ...f.key("second"),
      baseUrl: f.server.url.origin,
      credentialScope: "all-projects",
    });
    await f.request("second");
    expect(f.received.at(-1)).toBe("Bearer global-canary");
    expect(await f.secrets.listRefs()).toHaveLength(1);
    await f.connections.remove({ ...f.key("first"), credentialScope: "all-projects" });
    await expect(f.request("second")).rejects.toThrow("credential is not configured");
    expect(await f.secrets.listRefs()).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

test("revoking a shared sign-in preserves the same-origin project's own connection and credential", async () => {
  const f = await setup();
  try {
    await f.configure("first", "shared-canary");
    await f.connections.configure({
      ...f.key("second"),
      baseUrl: f.server.url.origin,
      secret: "project-canary",
      credentialScope: "project",
    });
    await f.request("first");
    await f.request("second");
    const before = await f.connections.list("second");
    expect((await f.connections.list("first"))[0]?.lastCheck).toMatchObject({ ok: true, status: 200 });
    await f.connections.remove({ ...f.key("second"), credentialScope: "all-projects" });
    expect(await f.connections.list("second")).toEqual(before);
    await f.request("second");
    expect(f.received).toEqual(["Bearer shared-canary", "Bearer project-canary", "Bearer project-canary"]);
    expect((await f.connections.list("first"))[0]).toMatchObject({ configured: false, lastCheck: null });
    await expect(f.request("first")).rejects.toThrow("credential is not configured");
    expect(await f.secrets.listRefs()).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});

test("a changed shared provider URL cannot receive an existing device credential", async () => {
  const f = await setup();
  const captured: string[] = [];
  const other = Bun.serve({
    port: 0,
    fetch: (request) => {
      captured.push(request.headers.get("authorization") ?? "none");
      return Response.json({ ok: true });
    },
  });
  try {
    await f.configure("first", "origin-canary");
    await f.configure("second");
    const [row] = await f.db.select().from(preferences).where(eq(preferences.scope_id, "second"));
    await f.db
      .update(preferences)
      .set({ value: { ...(row.value as object), base_url: other.url.origin } })
      .where(eq(preferences.scope_id, "second"));
    await expect(f.request("second")).rejects.toThrow("credential is not configured");
    expect(captured).toHaveLength(0);
  } finally {
    other.stop(true);
    await f.cleanup();
  }
});

test("an expired project sign-in does not silently switch to a device account", async () => {
  const f = await setup();
  try {
    await f.configure("first", "global-canary");
    await f.connections.configure({
      ...f.key("second"),
      baseUrl: f.server.url.origin,
      secret: "project-canary",
      credentialScope: "project",
    });
    const { credentials } = await import("pstdio-db");
    const scoped = await createExtensionConnectionsDBService(f.db).credentials.get({
      projectId: "second",
      extensionId: "example.shared-credential",
      contributionId: contribution.id,
    });
    await f.db
      .update(credentials)
      .set({ expires_at: "2000-01-01T00:00:00.000Z" })
      .where(eq(credentials.id, scoped!.id));
    await expect(f.request("second")).rejects.toThrow("credential is not configured");
    await expect(f.configure("second")).rejects.toThrow("credential is required");
    await f.request("first");
    expect(f.received.at(-1)).toBe("Bearer global-canary");
  } finally {
    await f.cleanup();
  }
});

test("uninstall cleanup discovers scoped credentials after project configuration has been purged", async () => {
  const f = await setup();
  try {
    const {
      createInstalledExtensionSourcesDBService,
      createExtensionInstancesDBService,
      createExtensionUserDataDBService,
    } = await import("pstdio-db");
    const source = await createInstalledExtensionSourcesDBService(f.db).register({
      install_name: "shared-credential",
      extension_id: "example.shared-credential",
      display_name: "Credential owner",
      source_kind: "local_path",
      source_path: "/credential-owner",
    });
    const instance = await createExtensionInstancesDBService(f.db).create({
      installed_extension_id: source.id,
      scope_type: "project",
      scope_id: "first",
    });
    await f.connections.configure({
      ...f.key("first"),
      baseUrl: f.server.url.origin,
      secret: "scoped-canary",
      credentialScope: "project",
    });
    await f.configure("second", "global-canary");
    await createExtensionUserDataDBService(f.db).deleteForInstance(instance.id);
    await f.connections.removeExtension("first", "example.shared-credential");
    await f.connections.reconcile();
    expect(
      await createExtensionConnectionsDBService(f.db).credentials.get({
        projectId: "first",
        extensionId: "example.shared-credential",
        contributionId: contribution.id,
      }),
    ).toBeNull();
    expect(await f.secrets.listRefs()).toHaveLength(1);
    await f.request("second");
    expect(f.received.at(-1)).toBe("Bearer global-canary");
  } finally {
    await f.cleanup();
  }
});

test("startup reconciliation removes orphan project credentials while preserving an installed provider and shared sign-in", async () => {
  const f = await setup(async (projectId) => projectId === "second");
  try {
    await f.connections.configure({
      ...f.key("first"),
      baseUrl: f.server.url.origin,
      secret: "orphan-canary",
      credentialScope: "project",
    });
    await f.configure("second", "global-canary");
    await f.db.delete(preferences).where(eq(preferences.project_id, "first"));
    await f.connections.reconcile();
    expect(
      await createExtensionConnectionsDBService(f.db).credentials.get({
        projectId: "first",
        extensionId: "example.shared-credential",
        contributionId: contribution.id,
      }),
    ).toBeNull();
    expect(await f.secrets.listRefs()).toHaveLength(1);
    await f.request("second");
    expect(f.received.at(-1)).toBe("Bearer global-canary");
    await f.connections.removeExtension("second", "example.shared-credential");
    await f.request("second");
    expect(f.received.at(-1)).toBe("Bearer global-canary");
  } finally {
    await f.cleanup();
  }
});

test("two shared sign-ins at different origins keep each project's credential", async () => {
  const f = await setup();
  const otherReceived: string[] = [];
  const other = Bun.serve({
    port: 0,
    fetch: (request) => {
      otherReceived.push(request.headers.get("authorization")!);
      return Response.json({ ok: true });
    },
  });
  try {
    await f.configure("first", "first-origin");
    await f.connections.configure({ ...f.key("second"), baseUrl: other.url.origin, secret: "second-origin" });
    await f.request("first");
    await f.request("second");
    expect(f.received).toEqual(["Bearer first-origin"]);
    expect(otherReceived).toEqual(["Bearer second-origin"]);
    expect(await f.secrets.listRefs()).toHaveLength(2);
    await f.connections.remove(f.key("first"));
    await f.connections.remove({
      ...f.key("first"),
      credentialScope: "all-projects",
      origin: f.server.url.origin,
    });
    await expect(f.configure("first")).rejects.toThrow("credential is required");
    await f.request("second");
    expect(otherReceived).toEqual(["Bearer second-origin", "Bearer second-origin"]);
    expect(await f.secrets.listRefs()).toHaveLength(1);
    await f.connections.remove({ ...f.key("second"), credentialScope: "all-projects" });
    expect(await f.secrets.listRefs()).toEqual([]);
  } finally {
    other.stop(true);
    await f.cleanup();
  }
});

test("projects using a shared sign-in retain their own connection health", async () => {
  const f = await setup();
  try {
    await f.configure("first", "shared-health");
    await f.configure("second");
    await f.request("first");
    f.setStatus(403);
    await f.request("second");
    expect((await f.connections.list("first"))[0]?.lastCheck).toMatchObject({ ok: true, status: 200 });
    expect((await f.connections.list("second"))[0]?.lastCheck).toMatchObject({ ok: false, status: 403 });

    f.setStatus(200);
    await f.request("second");
    expect((await f.connections.list("second"))[0]?.lastCheck).toMatchObject({ ok: true, status: 200 });
    await f.configure("first", "rotated-credential");
    expect((await f.connections.list("second"))[0]).toMatchObject({ configured: true, lastCheck: null });
    await f.request("second");
    expect(f.received.at(-1)).toBe("Bearer rotated-credential");
    expect((await f.connections.list("second"))[0]?.lastCheck).toMatchObject({ ok: true, status: 200 });
    expect(await f.secrets.listRefs()).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});

test("a detached sign-in ignores another contribution with a longer matching ID", async () => {
  const f = await setup();
  const received: string[] = [];
  const other = Bun.serve({
    port: 0,
    fetch: (request) => {
      received.push(request.headers.get("authorization")!);
      return Response.json({ ok: true });
    },
  });
  try {
    const primary = f.key("first");
    const neighbor = { ...primary, connectionId: `${primary.connectionId}:neighbor%2Fescaped` };
    await f.configure("first", "primary-credential");
    await f.connections.configure({ ...neighbor, baseUrl: other.url.origin, secret: "neighbor-credential" });
    await f.connections.remove(primary);
    await f.connections.remove({ ...primary, credentialScope: "all-projects" });
    await expect(f.configure("first")).rejects.toThrow("credential is required");
    await f.connections.request({ ...neighbor, input: { method: "GET", path: "/v1/workspaces" } });
    expect(received).toEqual(["Bearer neighbor-credential"]);
    expect(await f.secrets.listRefs()).toHaveLength(1);
  } finally {
    other.stop(true);
    await f.cleanup();
  }
});
