import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAutomationDBService, createDb } from "pstdio-db";
import { createTestApp } from "../../test-utils/create-test-app";
import { COMMAND_ID, createAutomationProject, EXTENSION_ID, PRIVATE_COMMAND_ID } from "./automation-runs.fixture";

let tempRoot: string;
let previousPstdioHome: string | undefined;
let previousDefaultExtensions: string | undefined;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-automation-eligibility-test-"));
  previousPstdioHome = process.env.PSTDIO_HOME;
  previousDefaultExtensions = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(tempRoot, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
});

afterEach(() => {
  if (previousPstdioHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousPstdioHome;
  if (previousDefaultExtensions === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaultExtensions;
  rmSync(tempRoot, { recursive: true, force: true });
});

const queueRuns = async (databasePath: string, projectId: string) => {
  const database = await createDb({ path: databasePath });
  try {
    const db = createAutomationDBService(database.db);
    const principal = await db.getOrCreateExtensionPrincipal({ projectId, extensionId: EXTENSION_ID });
    const queue = async (commandId: string, input: object) => {
      const { run } = await db.createRun({
        projectId,
        principalId: principal.id,
        tokenId: null,
        commandId,
        idempotencyKey: commandId,
        inputHash: commandId,
        inputJson: { commandId, input },
      });
      return run;
    };
    return {
      eligible: await queue(COMMAND_ID, { params: { amount: 2 } }),
      disabled: await queue(PRIVATE_COMMAND_ID, {}),
    };
  } finally {
    await database.close();
  }
};

test("startup recovery runs queued work only for commands still exposed to automation", async () => {
  const appOptions = { databasePath: join(tempRoot, "db"), storageRoot: join(tempRoot, "storage") };
  const setup = await createTestApp(appOptions);
  let projectId: string;
  try {
    projectId = await createAutomationProject((path, init) => setup.app.request(path, init), tempRoot);
  } finally {
    await setup.close();
  }
  // Runs accepted before a shutdown stay queued in the database until the next startup recovers them.
  const queued = await queueRuns(appOptions.databasePath, projectId);

  const recovered = await createTestApp(appOptions);
  try {
    const owner = { projectId, extensionId: EXTENSION_ID };
    const settledRun = async (runId: string) => {
      let run = await recovered.deps.automationService.getForExtension(owner, runId);
      for (let attempt = 0; attempt < 200 && (run?.status === "queued" || run?.status === "running"); attempt += 1) {
        await Bun.sleep(25);
        run = await recovered.deps.automationService.getForExtension(owner, runId);
      }
      return run;
    };

    expect(await settledRun(queued.eligible.id)).toMatchObject({ status: "succeeded", result: { count: 2 } });
    expect(await settledRun(queued.disabled.id)).toMatchObject({
      status: "rejected",
      error: { code: "automation_scope_denied" },
    });
  } finally {
    await recovered.close();
  }
});
