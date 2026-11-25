import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAutomationDBService, createDb, createEnvironmentDBService, createSettingsDBService } from "pstdio-db";
import { restoreReleasedPreferenceTables } from "pstdio-db/test-fixtures";
import { createTestApp } from "../../test-utils/create-test-app";
import { inputHash } from "./automation-policy";
import {
  COMMAND_ID,
  createAutomationProject,
  issueAutomationToken,
  RUNTIME_TOKEN,
  requestWithToken,
} from "./automation-runs.fixture";

test("a released replacement credential retries, executes and polls after upgrade", async () => {
  const root = await mkdtemp(join(tmpdir(), "automation-api-upgrade-"));
  const databasePath = join(root, "database");
  const previousHome = process.env.PSTDIO_HOME;
  const previousExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  let app: Awaited<ReturnType<typeof createTestApp>> | undefined;
  let source: Awaited<ReturnType<typeof createDb>> | undefined;
  const open = () =>
    createTestApp({
      databasePath,
      storageRoot: join(root, "storage"),
      host: { kind: "standalone", token: RUNTIME_TOKEN },
    });
  try {
    app = await open();
    const runtimeRequest = (path: string, init?: RequestInit) => requestWithToken(app!.app, RUNTIME_TOKEN, path, init);
    const projectId = await createAutomationProject(runtimeRequest, root);
    const { token } = await issueAutomationToken(runtimeRequest, projectId);
    const tokenId = token.split("_")[2];
    const { token: rotatedToken } = await issueAutomationToken(runtimeRequest, projectId);
    const rotatedId = rotatedToken.split("_")[2];
    await app.close();
    app = undefined;
    source = await createDb({ path: databasePath });
    const released = (await createAutomationDBService(source.db).getToken(tokenId))!;
    const rotated = (await createAutomationDBService(source.db).getToken(rotatedId))!.token;
    const settings = await createSettingsDBService(source.db).get();
    const environment = await createEnvironmentDBService(source.db).get();
    await restoreReleasedPreferenceTables(source);
    const p = {
      ...released.principal,
      id: crypto.randomUUID(),
      project_id: projectId,
      created_at: new Date().toISOString(),
    };
    await source.pglite.query("INSERT INTO automation_principals VALUES ($1,$2,$3,$4,$5,$6)", [
      p.id,
      p.project_id,
      p.name,
      p.created_by,
      p.created_at,
      p.disabled_at,
    ]);
    const t = released.token;
    await source.pglite.query("INSERT INTO automation_tokens VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)", [
      t.id,
      p.id,
      t.token_prefix,
      t.token_digest,
      t.project_id,
      JSON.stringify(t.command_scopes_json),
      t.expires_at,
      t.last_used_at,
      t.revoked_at,
      t.created_at,
    ]);
    await source.pglite.query("INSERT INTO automation_tokens VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)", [
      rotated.id,
      p.id,
      rotated.token_prefix,
      rotated.token_digest,
      rotated.project_id,
      JSON.stringify(rotated.command_scopes_json),
      rotated.expires_at,
      rotated.last_used_at,
      rotated.revoked_at,
      rotated.created_at,
    ]);
    await source.pglite.query("UPDATE automation_tokens SET revoked_at = $1 WHERE id = $2", [
      new Date().toISOString(),
      t.id,
    ]);
    await source.pglite.query("INSERT INTO settings VALUES ($1,$2,$3,$4,$5,$6)", [
      settings.id,
      settings.notifications_enabled,
      settings.machine_tokens_enabled,
      settings.max_concurrent_sessions,
      settings.created_at,
      settings.updated_at,
    ]);
    await source.pglite.query("INSERT INTO local_environment VALUES ('local',$1)", [environment.environmentId]);
    const retainedBody = { commandId: COMMAND_ID, input: { params: { amount: 5 } } };
    const retainedId = crypto.randomUUID();
    const stamp = new Date().toISOString();
    await source.pglite.query(
      "INSERT INTO automation_runs VALUES ($1,$2,$3,$4,$5,'retained',$6,$7::jsonb,'succeeded',$8::jsonb,NULL,$9,$9,$9)",
      [
        retainedId,
        projectId,
        p.id,
        t.id,
        COMMAND_ID,
        inputHash(retainedBody),
        JSON.stringify(retainedBody),
        JSON.stringify({ count: 5 }),
        stamp,
      ],
    );
    await source.close();
    source = undefined;
    app = await open();
    const path = `/v1/projects/${projectId}/automation-runs`;
    const machine = (url: string, init?: RequestInit) => requestWithToken(app!.app, rotatedToken, url, init);
    const start = (key: string, body: object) =>
      machine(path, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify(body),
      });
    expect((await requestWithToken(app.app, token, `${path}/${retainedId}`)).status).toBe(401);
    expect((await machine(`${path}/${retainedId}`)).status).toBe(200);
    const retry = await start("retained", retainedBody);
    expect(retry.status).toBe(202);
    expect(await retry.json()).toMatchObject({ id: retainedId, status: "succeeded", result: { count: 5 } });
    const { token: freshToken } = await issueAutomationToken(runtimeRequest, projectId);
    expect((await requestWithToken(app.app, freshToken, `${path}/${retainedId}`)).status).toBe(404);
    const started = await start("new-after-upgrade", { commandId: COMMAND_ID, input: { params: { amount: 2 } } });
    expect(started.status).toBe(202);
    let run = await started.json();
    for (let attempt = 0; attempt < 50 && run.status !== "succeeded"; attempt++) {
      await Bun.sleep(10);
      run = await (await machine(`${path}/${run.id}`)).json();
    }
    expect(run).toMatchObject({ status: "succeeded", result: { count: 2 } });
    const response = await machine(`${path}/${run.id}/events`);
    expect(response.status).toBe(200);
    const { events } = await response.json();
    expect(events.map((event: { type: string }) => event.type)).toEqual(["queued", "running", "succeeded"]);
    const resumed = await (await machine(`${path}/${run.id}/events?after=${events[1].cursor}`)).json();
    expect(resumed.events.map((event: { type: string }) => event.type)).toEqual(["succeeded"]);
    expect(JSON.stringify(run)).not.toContain(t.token_digest);
    expect(JSON.stringify(run)).not.toContain(token);
  } finally {
    await app?.close();
    await source?.close();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    if (previousExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousExtensions;
    await rm(root, { recursive: true, force: true });
  }
}, 10_000);
