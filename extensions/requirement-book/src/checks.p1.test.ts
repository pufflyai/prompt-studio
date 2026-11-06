import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { checkWorkspace } from "./checks";
import { BOOK_PATH, serializeBook } from "./model";
import { bookFixture } from "./model.fixture";
import { type Finding, listRecords, saveRecord } from "./records";

test("automatic checks preserve unresolved findings recorded by people", async () => {
  const root = await mkdtemp(join(tmpdir(), "book-check-"));
  try {
    const run = async (input: { command: string[]; cwd?: string }) => {
      const p = Bun.spawn(input.command, { cwd: input.cwd, stdout: "pipe", stderr: "pipe" });
      return {
        stdout: await new Response(p.stdout).text(),
        stderr: await new Response(p.stderr).text(),
        exitCode: await p.exited,
      };
    };
    await run({ command: ["git", "init", "-b", "main"], cwd: root });
    await mkdir(join(root, "documentation/requirement-book"), { recursive: true });
    await writeFile(join(root, BOOK_PATH), serializeBook(bookFixture()));
    await run({ command: ["git", "add", "."], cwd: root });
    await run({
      command: ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "Book"],
      cwd: root,
    });
    const storage = createMemoryStorage();
    const workspace = {
      id: "workspace",
      rootPath: root,
      providerState: "ready",
      executionKind: "local",
      capabilities: { files: "write" },
    };
    const [ctx] = makeCommandArgs({
      storage,
      params: {},
      overrides: { process: { run }, workspaces: { getDefault: async () => workspace } as never },
    });
    const manual: Finding = {
      id: "manual",
      workspaceId: "workspace",
      kind: "missing-evidence",
      title: "Audit concern",
      explanation: "Needs human assessment",
      requirements: ["RB 1.A.1"],
      observations: [],
      evidence: [],
      resolved: false,
      updatedAt: "now",
    };
    await saveRecord(storage, "finding", manual);
    await checkWorkspace(ctx);
    expect((await listRecords<Finding>(storage, "finding")).find((f) => f.id === "manual")?.resolved).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
