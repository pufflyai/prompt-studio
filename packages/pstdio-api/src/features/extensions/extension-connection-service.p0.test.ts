import { describe, expect, mock, test } from "bun:test";
import { createExtensionConnectionService } from "./extension-connection-service";
import { connection, contribution, createConnectionTestService } from "./extension-connection-service.test-fixture";

describe("extension connection service", () => {
  test("records an HTTP error response as a failed health check", async () => {
    let lastCheck: { ok: boolean; status: number | null; error: string | null; checkedAt: string } | null = null;
    const service = createExtensionConnectionService({
      connectionsDBService: {
        get: async () => ({ ...connection, last_check_json: lastCheck }),
        recordCheck: async (_key: unknown, check: NonNullable<typeof lastCheck>) => {
          lastCheck = check;
        },
      } as never,
      secretStore: {
        get: async () => "credential-canary",
        set: async () => "secret-1",
        delete: async () => {},
        listRefs: async () => ["secret-1"],
      },
      getContribution: async () => contribution,
      fetch: (async () => Response.json({ error: "unauthorized" }, { status: 401 })) as unknown as typeof fetch,
    });

    const checked = await service.check({
      projectId: "project-1",
      extensionId: "pstdio.remote",
      connectionId: "control-plane",
    });

    expect(checked.lastCheck).toMatchObject({ ok: false, status: 401 });
  });

  test("adds host-owned authentication to an allowed relative request", async () => {
    const fetchFn = mock(async (request: RequestInfo | URL, init?: RequestInit) => {
      expect(String(request)).toBe("https://control.example.test/v1/workspaces/remote-1");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer credential-canary");
      return Response.json({ id: "remote-1" }, { status: 200, headers: { "x-request-id": "req-1" } });
    });
    const service = createConnectionTestService(fetchFn as unknown as typeof fetch);

    const response = await service.request({
      projectId: "project-1",
      extensionId: "pstdio.remote",
      connectionId: "control-plane",
      input: { method: "GET", path: "/v1/workspaces/remote-1" },
    });

    expect(response).toEqual({
      status: 200,
      headers: { "content-type": "application/json;charset=utf-8", "x-request-id": "req-1" },
      body: { id: "remote-1" },
    });
    expect(JSON.stringify(response)).not.toContain("credential-canary");
  });

  test("rejects requests outside the declared method and path policy", async () => {
    const fetchFn = mock(async () => Response.json({ ok: true }));
    const service = createConnectionTestService(fetchFn as unknown as typeof fetch);

    await expect(
      service.request({
        projectId: "project-1",
        extensionId: "pstdio.remote",
        connectionId: "control-plane",
        input: { method: "DELETE", path: "/v1/admin" },
      }),
    ).rejects.toThrow("not allowed");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("captures project credentials and deletes them after project metadata is removed", async () => {
    const deleteSecret = mock(async () => {});
    const service = createExtensionConnectionService({
      connectionsDBService: {
        listByProject: async () => [connection, { ...connection, id: "connection-record-2", secret_ref: null }],
      } as never,
      secretStore: {
        get: async () => null,
        set: async () => "secret-1",
        delete: deleteSecret,
        listRefs: async () => ["secret-1"],
      },
      getContribution: async () => contribution,
      fetch,
    });

    const removeSecrets = await service.prepareProjectRemoval("project-1");

    expect(deleteSecret).not.toHaveBeenCalled();
    await removeSecrets();
    expect(deleteSecret).toHaveBeenCalledTimes(1);
    expect(deleteSecret).toHaveBeenCalledWith("secret-1");
  });

  test("commits connection metadata removal when credential cleanup must retry", async () => {
    const remove = mock(async () => connection);
    const service = createExtensionConnectionService({
      connectionsDBService: { get: async () => connection, remove } as never,
      secretStore: {
        get: async () => "credential-canary",
        set: async () => "secret-1",
        delete: async () => {
          throw new Error("secret backend unavailable");
        },
        listRefs: async () => ["secret-1"],
      },
      getContribution: async () => contribution,
      fetch,
    });

    await expect(
      service.remove({ projectId: "project-1", extensionId: "pstdio.remote", connectionId: "control-plane" }),
    ).resolves.toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  test("removes extension connection secrets and rows with retry-safe ordering", async () => {
    const remove = mock(async () => connection);
    const deleteSecret = mock(async () => {});
    const service = createExtensionConnectionService({
      connectionsDBService: {
        get: async () => connection,
        listByExtension: async () => [connection],
        remove,
      } as never,
      secretStore: {
        get: async () => "credential-canary",
        set: async () => "secret-1",
        delete: deleteSecret,
        listRefs: async () => ["secret-1"],
      },
      getContribution: async () => contribution,
      fetch,
    });

    await service.removeExtension("project-1", "pstdio.remote");

    expect(deleteSecret).toHaveBeenCalledWith("secret-1");
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe("extension connection credential ownership", () => {
  test("removes a newly written credential when connection configuration fails", async () => {
    const deleteSecret = mock(async () => {});
    const service = createExtensionConnectionService({
      connectionsDBService: {
        get: async () => connection,
        upsert: async () => {
          throw new Error("database unavailable");
        },
      } as never,
      secretStore: {
        get: async () => "credential-canary",
        set: async (_secret: string, ref?: string) => {
          expect(ref).toBeUndefined();
          return "secret-new";
        },
        delete: deleteSecret,
        listRefs: async () => ["secret-1", "secret-new"],
      },
      getContribution: async () => contribution,
      fetch,
    });

    await expect(
      service.configure({
        projectId: "project-1",
        extensionId: "pstdio.remote",
        connectionId: "control-plane",
        baseUrl: "https://control.example.test/api/",
        secret: "replacement",
      }),
    ).rejects.toThrow("database unavailable");
    expect(deleteSecret).toHaveBeenCalledWith("secret-new");
  });

  test("keeps a credential when removing its connection metadata fails", async () => {
    const deleteSecret = mock(async () => {});
    const service = createExtensionConnectionService({
      connectionsDBService: {
        get: async () => connection,
        remove: async () => {
          throw new Error("database unavailable");
        },
      } as never,
      secretStore: {
        get: async () => "credential-canary",
        set: async () => "secret-1",
        delete: deleteSecret,
        listRefs: async () => ["secret-1"],
      },
      getContribution: async () => contribution,
      fetch,
    });

    await expect(
      service.remove({ projectId: "project-1", extensionId: "pstdio.remote", connectionId: "control-plane" }),
    ).rejects.toThrow("database unavailable");
    expect(deleteSecret).not.toHaveBeenCalled();
  });

  test("reconciles stale connection rows and unreferenced secret files", async () => {
    const rows = [connection];
    const secretRefs = new Set(["secret-1", "secret-orphan"]);
    const deletedSecrets: string[] = [];
    const service = createExtensionConnectionService({
      connectionsDBService: {
        get: async () => rows[0] ?? null,
        listAll: async () => rows,
        remove: async () => rows.shift() ?? null,
      } as never,
      secretStore: {
        get: async () => "credential-canary",
        set: async () => "secret-1",
        delete: async (ref: string) => {
          deletedSecrets.push(ref);
          secretRefs.delete(ref);
        },
        listRefs: async () => [...secretRefs],
      },
      getContribution: async () => contribution,
      isExtensionInstalled: async () => false,
      fetch,
    });

    await service.reconcile();

    expect(rows).toEqual([]);
    expect(deletedSecrets).toEqual(["secret-1", "secret-orphan"]);
  });

  test("rolls connection metadata back when the previous credential cannot be removed", async () => {
    const upserts: Array<{ secretRef?: string | null }> = [];
    const deleteSecret = mock(async (ref: string) => {
      if (ref === "secret-1") throw new Error("old credential delete failed");
    });
    const service = createExtensionConnectionService({
      connectionsDBService: {
        get: async () => connection,
        upsert: async (input: { secretRef?: string | null }) => {
          upserts.push(input);
          return { ...connection, secret_ref: input.secretRef ?? null };
        },
      } as never,
      secretStore: {
        get: async () => "credential-canary",
        set: async () => "secret-new",
        delete: deleteSecret,
        listRefs: async () => ["secret-1", "secret-new"],
      },
      getContribution: async () => contribution,
      fetch,
    });

    await expect(
      service.configure({
        projectId: "project-1",
        extensionId: "pstdio.remote",
        connectionId: "control-plane",
        baseUrl: "https://new.example.test/",
        secret: "replacement",
      }),
    ).rejects.toThrow("old credential delete failed");
    expect(upserts.map((input) => input.secretRef)).toEqual(["secret-new", "secret-1"]);
    expect(deleteSecret).toHaveBeenCalledWith("secret-new");
  });
});
