import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { bookMenu } from "./book-menu";
import { BOOK_PATH, serializeBook } from "./model";
import { bookFixture } from "./model.fixture";
import { saveRecord } from "./records";
import { resourceContributions } from "./resources";

test("navigation resolves current rules without rechecking every evidence file", async () => {
  const root = await mkdtemp(join(tmpdir(), "book-navigation-"));
  try {
    const commands: string[][] = [];
    const run = async (input: { command: string[]; cwd?: string }) => {
      commands.push(input.command);
      const process = Bun.spawn(input.command, { cwd: input.cwd, stdout: "pipe", stderr: "pipe" });
      return {
        stdout: await new Response(process.stdout).text(),
        stderr: await new Response(process.stderr).text(),
        exitCode: await process.exited,
      };
    };
    await run({ command: ["git", "init", "-b", "main"], cwd: root });
    await mkdir(join(root, "documentation/requirement-book"), { recursive: true });
    const book = bookFixture();
    await writeFile(join(root, BOOK_PATH), serializeBook(book));
    await writeFile(join(root, "code.ts"), "export const value = 1;");
    await run({ command: ["git", "add", "."], cwd: root });
    await run({
      command: ["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-m", "Book"],
      cwd: root,
    });
    const storage = createMemoryStorage();
    await saveRecord(storage, "observation", {
      id: "source",
      workspaceId: "workspace",
      title: "Source",
      kind: "source",
      claim: "Inspected code",
      conditions: "Source inspection",
      limits: "No execution",
      revision: "head",
      updatedAt: "now",
      requirements: [book.rules[0].ref],
      sources: [{ path: "code.ts", hash: "previous" }],
    });
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
      overrides: {
        projectId: "project",
        process: { run },
        workspaces: { getDefault: async () => workspace, list: async () => [workspace] } as never,
      },
    });
    const resolver = resourceContributions.find((item) => item.kind.id === "requirement")!.resolve;
    commands.length = 0;
    const first = await resolver.run(ctx, { reference: book.rules[0].ref });
    expect(first?.label).toBe(book.rules[0].title);
    expect(commands.filter((command) => command[1] === "hash-object")).toHaveLength(0);
    const presentation = await bookMenu.query!(ctx, {
      renderer: { resource: { type: "requirement", id: book.rules[0].ref }, pageParams: {} },
    } as never);
    expect(presentation.label).toBe(`${book.rules[0].ref} ${book.rules[0].title}`);
    book.rules[0].title = "Changed on disk";
    await writeFile(join(root, BOOK_PATH), serializeBook(book));
    expect((await resolver.run(ctx, { reference: book.rules[0].ref }))?.label).toBe("Changed on disk");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
