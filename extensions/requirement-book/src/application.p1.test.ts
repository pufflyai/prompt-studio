import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { BOOK_PATH, serializeBook } from "./model";
import { bookFixture } from "./model.fixture";
import { readRecord, type Suggestion, suggestionDigest } from "./records";
import { readRepository, writeRepository } from "./repository";
import { suggestionCommands as commands } from "./suggestions";

test("removal recovers after a post-write storage failure and protects its application journal", async () => {
  const root = await mkdtemp(join(tmpdir(), "book-application-"));
  const home = join(root, "home");
  const project = join(root, "project");
  const extensionId = "pstdio.requirement-book";
  const files = join(home, ".pstdio/extension-storage", extensionId);
  let failAfterApply = false;
  let armed = false;
  const run = async (input: { command: string[]; cwd?: string }) => {
    const child = Bun.spawn(input.command, { cwd: input.cwd, stdout: "pipe", stderr: "pipe" });
    const result = {
      stdout: await new Response(child.stdout).text(),
      stderr: await new Response(child.stderr).text(),
      exitCode: await child.exited,
    };
    if (armed && input.command[1] === "apply" && !result.exitCode) {
      failAfterApply = true;
      armed = false;
    }
    return result;
  };
  const git = (...args: string[]) => run({ command: ["git", ...args], cwd: project });
  try {
    await mkdir(join(project, dirname(BOOK_PATH)), { recursive: true });
    await git("init", "-b", "main");
    const book = bookFixture();
    await writeFile(join(project, BOOK_PATH), serializeBook(book));
    await git("add", ".");
    await git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "Book");
    await git("checkout", "-b", "working");
    let target = "main";
    const workspace = {
      id: "working",
      rootPath: project,
      providerState: "ready",
      executionKind: "local",
      capabilities: { files: "write" },
      isDefault: false,
    };
    const storage = createMemoryStorage();
    const [ctx] = makeCommandArgs({
      storage,
      params: {},
      overrides: {
        extensionId,
        process: { run },
        workspaces: {
          get: async () => workspace,
          getDefault: async () => ({ id: "default", rootPath: home, isDefault: true }),
        } as never,
        settings: { get: async (key: string) => (key === "targetBranch" ? target : "working") } as never,
        extensionFiles: {
          writeText: async (path: string, content: string) => {
            await mkdir(dirname(join(files, path)), { recursive: true });
            await writeFile(join(files, path), content);
          },
          delete: async (path: string) => rm(join(files, path)),
        } as never,
      },
    });
    const input = {
      workspaceId: "working",
      title: "Remove rule",
      reason: "No longer required",
      operations: [{ type: "REMOVE" as const, before: book.rules[0], after: null }],
    };
    const suggestion = await commands.suggest.run(ctx, input);
    const apply = { id: suggestion.id, expectedDigest: suggestionDigest(suggestion) };
    const commit = storage.records.commit.bind(storage.records);
    storage.records.commit = async (group) => {
      if (failAfterApply) {
        failAfterApply = false;
        throw new Error("Final marker unavailable");
      }
      return commit(group);
    };
    armed = true;
    await expect(commands["suggestions.apply"].run(ctx, apply)).rejects.toThrow("Final marker unavailable");
    expect((await readRepository(ctx, "working")).book?.retired).toContain(book.rules[0].ref);
    expect((await readRecord<Suggestion>(storage, "suggestion", suggestion.id)).value?.appliedRevision).toBeNull();
    await expect(commands.suggest.run(ctx, { ...input, id: suggestion.id })).rejects.toThrow("pending");
    await expect(commands["suggestions.reconcile"].run(ctx, apply)).rejects.toThrow("pending");
    await expect(commands["suggestions.discard"].run(ctx, { id: suggestion.id })).rejects.toThrow("pending");
    await expect(commands["suggestions.cancel-application"].run(ctx, { id: suggestion.id })).rejects.toThrow(
      "file changed",
    );
    const recovered = await commands["suggestions.apply"].run(ctx, apply);
    expect(recovered.appliedRevision).toBeTruthy();
    await git("checkout", "main");
    await git("update-ref", "refs/remotes/upstream/main", "HEAD");
    target = "upstream/main";
    const before = await readFile(join(project, BOOK_PATH), "utf8");
    await expect(writeRepository(ctx, "working", before, book)).rejects.toThrow();
    expect(await readFile(join(project, BOOK_PATH), "utf8")).toBe(before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
