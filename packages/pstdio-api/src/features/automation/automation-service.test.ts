import { describe, expect, mock, test } from "bun:test";
import { createAutomationService } from "./automation-service";

describe("automation service recovery", () => {
  test("contains a detached claim failure so queued recovery does not create an unhandled rejection", async () => {
    const service = createAutomationService({
      automationDBService: {
        listQueuedRuns: async () => [{ id: "run-claim-failure" }],
        claimQueuedRun: async () => {
          throw new Error("db claim failed");
        },
      } as never,
      getCommandDeps: () => ({}) as never,
    });

    expect(await service.recoverQueuedRuns()).toBe(1);
    await Bun.sleep(0);
    await expect(service.close()).resolves.toBeUndefined();
  });

  test("starts every durable queued run after the command runtime is ready", async () => {
    const claimQueuedRun = mock(async () => null);
    const service = createAutomationService({
      automationDBService: {
        listQueuedRuns: async () => [{ id: "run-1" }, { id: "run-2" }],
        claimQueuedRun,
      } as never,
      getCommandDeps: () => ({}) as never,
    });

    expect(await service.recoverQueuedRuns()).toBe(2);
    await service.close();

    expect(claimQueuedRun).toHaveBeenCalledTimes(2);
    expect(claimQueuedRun).toHaveBeenCalledWith("run-1");
    expect(claimQueuedRun).toHaveBeenCalledWith("run-2");
  });

  test("aborts active command execution before orderly shutdown waits", async () => {
    let observedAbort = false;
    const running = {
      id: "run-1",
      project_id: "project-1",
      principal_id: "principal-1",
      token_id: "token-1",
      command_id: "pstdio.test.command.blocking",
      idempotency_key: "blocking-1",
      input_hash: "hash-1",
      input_json: { commandId: "pstdio.test.command.blocking", input: {} },
      status: "running",
      result_json: null,
      error_json: null,
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      finished_at: null,
    } as const;
    const service = createAutomationService({
      automationDBService: {
        listQueuedRuns: async () => [{ id: "run-1" }],
        claimQueuedRun: async () => running,
        transitionRun: async () => running,
      } as never,
      getCommandDeps: () =>
        ({
          activityEventsService: { create: async () => {} },
        }) as never,
      executeCommand: async (_deps, input) =>
        new Promise((resolve) => {
          input.signal?.addEventListener(
            "abort",
            () => {
              observedAbort = true;
              resolve({ outcome: { ok: false, status: "error", reason: "aborted" } } as never);
            },
            { once: true },
          );
        }),
      shutdownGraceMs: 50,
    });

    await service.recoverQueuedRuns();
    await Bun.sleep(0);
    await service.close();

    expect(observedAbort).toBe(true);
  });

  test("restarts an existing queued run on an idempotent retry", async () => {
    const claimQueuedRun = mock(async () => null);
    let storedToken: Record<string, unknown> | null = null;
    const queued = {
      id: "run-queued",
      project_id: "project-1",
      principal_id: "principal-1",
      token_id: "token-1",
      command_id: "pstdio.test.command.run",
      idempotency_key: "retry-1",
      input_hash: "zRgBtG4WP6PCGSNTVaDhky5xh9vHJB8Ge1XSfSs5WGw",
      input_json: { commandId: "pstdio.test.command.run", input: {} },
      status: "queued",
      result_json: null,
      error_json: null,
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
    } as const;
    const service = createAutomationService({
      automationDBService: {
        createToken: async (input: Record<string, unknown>) => {
          storedToken = {
            principal: {
              id: "principal-1",
              name: input.name,
              created_by: input.createdBy,
              created_at: new Date().toISOString(),
              disabled_at: null,
            },
            token: {
              id: input.tokenId,
              principal_id: "principal-1",
              token_prefix: input.tokenPrefix,
              token_digest: input.tokenDigest,
              project_id: input.projectId,
              command_scopes_json: input.commandScopes,
              expires_at: input.expiresAt,
              last_used_at: null,
              revoked_at: null,
              created_at: new Date().toISOString(),
            },
          };
          return storedToken;
        },
        getToken: async () => storedToken,
        markTokenUsed: async () => {},
        pruneTerminalRuns: async () => [],
        getRunByIdempotency: async () => queued,
        claimQueuedRun,
      } as never,
      getCommandDeps: () =>
        ({
          extensionRuntimeCatalog: {
            get: async () => ({
              runtime: { commands: [{ id: "pstdio.test.command.run", automation: true }] },
            }),
          },
        }) as never,
    });
    const issued = await service.issueToken({
      name: "retry test",
      projectId: "project-1",
      commandScopes: ["pstdio.test.command.run"],
      expiresInSeconds: 60,
    });

    await service.createRun({
      rawToken: issued.token,
      projectId: "project-1",
      idempotencyKey: "retry-1",
      body: { commandId: "pstdio.test.command.run", input: {} },
    });
    await Bun.sleep(0);
    await service.close();

    expect(claimQueuedRun).toHaveBeenCalledTimes(1);
  });
});

describe("automation authentication", () => {
  test("rate limits repeated secret verification for a known token id", async () => {
    let storedToken: Record<string, unknown> | null = null;
    const service = createAutomationService({
      automationDBService: {
        createToken: async (input: Record<string, unknown>) => {
          storedToken = {
            principal: {
              id: "principal-1",
              project_id: input.projectId,
              name: input.name,
              created_by: input.createdBy,
              created_at: new Date().toISOString(),
              disabled_at: null,
            },
            token: {
              id: input.tokenId,
              principal_id: "principal-1",
              token_prefix: input.tokenPrefix,
              token_digest: input.tokenDigest,
              project_id: input.projectId,
              command_scopes_json: input.commandScopes,
              expires_at: input.expiresAt,
              last_used_at: null,
              revoked_at: null,
              created_at: new Date().toISOString(),
            },
          };
          return storedToken;
        },
        getToken: async () => storedToken,
        markTokenUsed: async () => {},
      } as never,
      getCommandDeps: () =>
        ({
          extensionRuntimeCatalog: {
            get: async () => ({ runtime: { commands: [{ id: "pstdio.test.command.run", automation: true }] } }),
          },
        }) as never,
      maxAuthAttemptsPerMinute: 2,
    });
    const issued = await service.issueToken({
      name: "auth test",
      projectId: "project-1",
      commandScopes: ["pstdio.test.command.run"],
      expiresInSeconds: 60,
    });
    const invalidToken = issued.token.replace(/_[^_]+$/, "_wrong-secret");

    await expect(service.getRun(invalidToken, "project-1", "run-1")).rejects.toMatchObject({ status: 401 });
    await expect(service.getRun(invalidToken, "project-1", "run-1")).rejects.toMatchObject({ status: 401 });
    await expect(service.getRun(invalidToken, "project-1", "run-1")).rejects.toMatchObject({
      code: "automation_auth_rate_limited",
      status: 429,
    });
  });
});

describe("automation service cancellation", () => {
  test("returns after the grace period when a command ignores cancellation", async () => {
    let storedToken: Record<string, unknown> | null = null;
    let storedRun: Record<string, unknown> = {
      id: "run-1",
      project_id: "project-1",
      principal_id: "principal-1",
      token_id: "token-1",
      command_id: "pstdio.test.command.blocking",
      idempotency_key: "blocking-1",
      input_hash: "hash-1",
      input_json: { commandId: "pstdio.test.command.blocking", input: {} },
      status: "queued",
      result_json: null,
      error_json: null,
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
    };
    const service = createAutomationService({
      automationDBService: {
        createToken: async (input: Record<string, unknown>) => {
          storedToken = {
            principal: { id: "principal-1", name: input.name, disabled_at: null },
            token: {
              id: input.tokenId,
              project_id: input.projectId,
              command_scopes_json: input.commandScopes,
              token_digest: input.tokenDigest,
              expires_at: input.expiresAt,
              revoked_at: null,
            },
          };
          return storedToken;
        },
        getToken: async () => storedToken,
        markTokenUsed: async () => {},
        listQueuedRuns: async () => [storedRun],
        claimQueuedRun: async () => {
          storedRun = { ...storedRun, status: "running" };
          return storedRun;
        },
        getRun: async () => storedRun,
        getRunById: async () => storedRun,
        transitionRun: async (_id: string, input: { status: string }) => {
          storedRun = { ...storedRun, status: input.status };
          return storedRun;
        },
      } as never,
      getCommandDeps: () =>
        ({
          activityEventsService: { create: async () => {} },
          extensionRuntimeCatalog: {
            get: async () => ({
              runtime: { commands: [{ id: "pstdio.test.command.blocking", automation: true }] },
            }),
          },
        }) as never,
      executeCommand: async () => new Promise(() => {}),
      shutdownGraceMs: 5,
    });
    const issued = await service.issueToken({
      name: "cancel test",
      projectId: "project-1",
      commandScopes: ["pstdio.test.command.blocking"],
      expiresInSeconds: 60,
    });
    await service.recoverQueuedRuns();
    await Bun.sleep(0);

    const startedAt = performance.now();
    await expect(service.cancelRun(issued.token, "project-1", "run-1")).rejects.toMatchObject({
      code: "automation_cancellation_pending",
      status: 409,
    });

    expect(performance.now() - startedAt).toBeLessThan(100);
    expect(storedRun.status).toBe("running");
  });
});
