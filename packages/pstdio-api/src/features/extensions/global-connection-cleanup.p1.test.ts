import { expect, test } from "bun:test";
import { createDb, createExtensionConnectionsDBService, createProjectsDBService } from "pstdio-db";
import { createMemoryConnectionSecretStore } from "./connection-secret-store";
import { createExtensionConnectionService } from "./extension-connection-service";
import { contribution } from "./extension-connection-service.test-fixture";

test.each([
  "lookup",
  "remove",
  "list",
  "observer-sync",
  "observer-async",
])("a committed global save survives legacy-copy cleanup failure (%s)", async (phase) => {
  const store = await createDb({ path: ":memory:" });
  const db = createExtensionConnectionsDBService(store.db);
  const secrets = createMemoryConnectionSecretStore();
  const input = { projectId: "origin", extensionId: "pstdio.remote", connectionId: contribution.id };
  const key = { extensionId: input.extensionId, contributionId: input.connectionId };
  const base = { ...key, baseUrl: "https://example.test", authType: "bearer" as const, authHeaderName: null };
  const failure = new Error("Legacy copy unavailable");
  const errors: { error: unknown; context: unknown }[] = [];
  let armed = true;
  try {
    for (const projectId of ["origin", "blocked", "later", "project-only"]) {
      await createProjectsDBService(store.db).create({ id: projectId, name: projectId });
      await db.upsert({ ...base, projectId, secretRef: await secrets.set(`${projectId}-credential`) });
    }
    const previous = await secrets.set("previous-global-credential");
    await db.upsert({ ...base, projectId: null, secretRef: previous });
    const service = createExtensionConnectionService({
      connectionsDBService: {
        ...db,
        listAll: async () => {
          if (armed && phase === "list") throw failure;
          // Visit the failing copy before the healthy one to prove progress.
          return (await db.listAll()).sort((a, b) => (a.project_id ?? "").localeCompare(b.project_id ?? ""));
        },
        remove: async (copy) => {
          if (armed && phase === "remove" && copy.projectId === "blocked") throw failure;
          return db.remove(copy);
        },
      },
      secretStore: secrets,
      getContribution: async ({ projectId }) => {
        if (armed && phase !== "list" && phase !== "remove" && projectId === "blocked") throw failure;
        return projectId === "project-only" ? contribution : { ...contribution, scope: "global" as const };
      },
      onCleanupError: (error, context) => {
        errors.push({ error, context });
        if (phase === "observer-sync") throw new Error("Cleanup observer unavailable");
        if (phase === "observer-async") return Promise.reject(new Error("Cleanup observer unavailable"));
      },
    });
    expect(
      await service.configure({ ...input, baseUrl: base.baseUrl, secret: "active-global-credential" }),
    ).toMatchObject({ scope: "global", configured: true });
    const active = await db.get({ ...key, projectId: null });
    expect(await secrets.get(active!.secret_ref!)).toBe("active-global-credential");
    expect(await secrets.get(previous)).toBeNull();
    expect(await db.listByProject("blocked")).toHaveLength(1);
    expect(await db.listByProject("later")).toHaveLength(phase === "list" ? 1 : 0);
    expect(await db.listByProject("project-only")).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.error).toBe(failure);
    expect(errors[0]?.context).toMatchObject({
      operation: phase === "list" ? "list_global_connection_copies" : "remove_global_connection_copy",
      extensionId: input.extensionId,
      connectionId: input.connectionId,
      ...(phase === "list" ? {} : { projectId: "blocked" }),
    });
    armed = false;
    await service.configure({ ...input, baseUrl: base.baseUrl });
    expect(await db.listAll()).toHaveLength(2);
    expect(await db.listByProject("blocked")).toEqual([]);
    expect(await db.listByProject("project-only")).toHaveLength(1);
    expect(await secrets.listRefs()).toHaveLength(2);
    expect(errors).toHaveLength(1);
  } finally {
    await store.close();
  }
});
