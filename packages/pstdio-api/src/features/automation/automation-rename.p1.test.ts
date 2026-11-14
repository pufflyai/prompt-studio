import { expect, test } from "bun:test";
import { createAutomationDBService, createDb, createProjectsDBService } from "pstdio-db";
import { normalizeExtensionSources } from "pstdio-extensions";
import { digestTokenSecret, inputHash } from "./automation-policy";
import { createAutomationService } from "./automation-service";

const historical = "pstdio.pstdio-notes.command.notes.create";
const canonical = "pstdio.notes.command.notes.create";

test("historical exact grants and completed idempotent runs retain their secrets and identity", async () => {
  const database = await createDb({ path: ":memory:" });
  const db = createAutomationDBService(database.db);
  const runtime = normalizeExtensionSources([
    {
      packagePath: "/notes",
      sourcePath: "/notes/extension.ts",
      sourceKind: "local_path",
      manifest: {
        id: "pstdio.notes",
        publisher: "pstdio",
        name: "notes",
        version: "1.0.0",
        main: "extension.ts",
        enginesPstdio: "^0.4.0 || ^0.5.0",
      },
      definition: {
        commands: [
          {
            id: "notes.create",
            ref: { kind: "command", id: "notes.create" },
            title: "Create",
            automation: true,
            run() {},
          },
        ],
      },
    },
  ]);
  const service = createAutomationService({
    automationDBService: db,
    getCommandDeps: () =>
      ({
        extensionRuntimeCatalog: { get: async () => ({ runtime }) },
        activityEventsService: { create: async () => {} },
      }) as never,
  });
  try {
    const project = await createProjectsDBService(database.db).create({ name: "Upgrade" });
    const tokenId = crypto.randomUUID();
    const digest = digestTokenSecret("retained-secret", "retained-salt");
    const granted = await db.createToken({
      name: "Original",
      createdBy: "local-user",
      tokenId,
      tokenPrefix: `pst_at_${tokenId}`,
      tokenDigest: digest,
      projectId: project.id,
      commandScopes: [historical],
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    const body = { commandId: historical, input: { params: {} } };
    const storedHash = inputHash(body);
    const { run } = await db.createRun({
      projectId: project.id,
      principalId: granted!.principal.id,
      tokenId,
      commandId: historical,
      idempotencyKey: "retained",
      inputHash: storedHash,
      inputJson: body,
    });
    await db.transitionRun(run.id, { status: "succeeded", result: { value: "original" } });
    const rawToken = `pst_at_${tokenId}_retained-secret`;
    const request = (commandId: string) =>
      service.createRun({ rawToken, projectId: project.id, idempotencyKey: "retained", body: { ...body, commandId } });
    expect(await request(canonical)).toMatchObject({ id: run.id, commandId: canonical, status: "succeeded" });
    await expect(request("alice.pstdio-notes.command.notes.create")).rejects.toMatchObject({ status: 403 });
    expect((await db.getToken(tokenId))!.token).toMatchObject({
      token_digest: digest,
      command_scopes_json: [historical],
    });
    expect(await db.getRun(project.id, run.id)).toMatchObject({ input_hash: storedHash, command_id: historical });
    expect(await service.getRun(rawToken, project.id, run.id)).toMatchObject({ id: run.id, commandId: canonical });
    expect((await service.listTokens(project.id))[0]?.commandScopes).toEqual([canonical]);
  } finally {
    await service.close();
    await database.close();
  }
});
