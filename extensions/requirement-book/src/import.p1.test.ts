import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { bookCommands } from "./import";
import { bookFixture } from "./model.fixture";
import { readRepository, writeRepository } from "./repository";

test("bulk import refuses competing authority and stale writes, and changes only the working branch", async () => {
  const root = await mkdtemp(join(tmpdir(), "book-import-"));
  const project = join(root, "project");
  const home = join(root, "home");
  const files = join(home, ".pstdio/extension-storage/pstdio.requirement-book");
  const run = async (input: { command: string[]; cwd?: string }) => {
    const child = Bun.spawn(input.command, { cwd: input.cwd, stdout: "pipe", stderr: "pipe" });
    return {
      stdout: await new Response(child.stdout).text(),
      stderr: await new Response(child.stderr).text(),
      exitCode: await child.exited,
    };
  };
  const git = (...args: string[]) => run({ command: ["git", ...args], cwd: project });
  try {
    await mkdir(join(project, "documentation/requirements"), { recursive: true });
    await mkdir(files, { recursive: true });
    await writeFile(join(project, "documentation/requirements/old.md"), "Old requirement authority\n");
    await git("init", "-b", "main");
    await git("add", ".");
    await git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "Legacy");
    await git("checkout", "-b", "working");
    const workspace = {
      id: "working",
      rootPath: project,
      providerState: "ready",
      executionKind: "local",
      capabilities: { files: "write" },
    };
    let incoming = bookFixture();
    const [ctx] = makeCommandArgs({
      storage: createMemoryStorage(),
      params: {},
      overrides: {
        extensionId: "pstdio.requirement-book",
        process: { run },
        workspaces: {
          get: async () => workspace,
          getDefault: async () => ({ id: "default", rootPath: home, isDefault: true }),
        } as never,
        settings: { get: async (key: string) => (key === "targetBranch" ? "main" : "working") } as never,
        extensionFiles: {
          readText: async () => JSON.stringify(incoming),
          writeText: async (path: string, content: string) => {
            await mkdir(join(files, "patches"), { recursive: true });
            await writeFile(join(files, path), content);
          },
          delete: async (path: string) => rm(join(files, path)),
        } as never,
      },
    });
    const input = { workspaceId: "working", path: "imports/book.json", expectedDigest: "missing" };
    await expect(bookCommands["book.import"].run(ctx, input)).rejects.toThrow("requirements");
    await rm(join(project, "documentation/requirements/old.md"));
    expect(await bookCommands["book.import"].run(ctx, input)).toMatchObject({ chapters: 2, rules: 3 });
    expect((await readRepository(ctx, "working")).book?.rules).toHaveLength(3);
    expect((await readRepository(ctx, "working", "accepted")).book).toBeNull();
    await expect(bookCommands["book.import"].run(ctx, input)).rejects.toThrow("changed");
    const prior = await readRepository(ctx, "working");
    const retired = { ...incoming, rules: incoming.rules.slice(1), retired: [incoming.rules[0].ref] };
    await writeRepository(ctx, "working", prior.content, retired);
    const current = await readRepository(ctx, "working");
    await expect(bookCommands["book.import"].run(ctx, { ...input, expectedDigest: current.digest })).rejects.toThrow(
      "retired",
    );
    incoming = { ...retired, rules: [] };
    await expect(bookCommands["book.import"].run(ctx, { ...input, expectedDigest: current.digest })).rejects.toThrow(
      "retired",
    );
    incoming = { ...retired, rules: [], retired: [...retired.retired, ...retired.rules.map((rule) => rule.ref)] };
    expect(await bookCommands["book.import"].run(ctx, { ...input, expectedDigest: current.digest })).toMatchObject({
      rules: 0,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
