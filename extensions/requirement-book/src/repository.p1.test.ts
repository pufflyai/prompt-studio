import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { BOOK_PATH, serializeBook } from "./model";
import { bookFixture } from "./model.fixture";
import { readWorkingText, replacementPatch } from "./repository";

const directories: string[] = [];
afterEach(async () => {
  for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true });
});
test("Git reads working content and rejects replacement of a stale complete book", async () => {
  const root = await mkdtemp(join(tmpdir(), "requirement-book-"));
  directories.push(root);
  const process = {
    run: async (input: { command: string[]; cwd?: string }) => {
      const child = Bun.spawn(input.command, { cwd: input.cwd, stdout: "pipe", stderr: "pipe" });
      return {
        stdout: await new Response(child.stdout).text(),
        stderr: await new Response(child.stderr).text(),
        exitCode: await child.exited,
      };
    },
  };
  const [ctx] = makeCommandArgs({ storage: createMemoryStorage(), params: {}, overrides: { process } });
  await process.run({ command: ["git", "init"], cwd: root });
  await mkdir(join(root, "documentation/requirement-book"), { recursive: true });
  const book = bookFixture();
  const before = serializeBook(book);
  await writeFile(join(root, BOOK_PATH), before);
  expect(await readWorkingText(ctx, root, BOOK_PATH)).toBe(before);
  const after = serializeBook({ ...book, retired: ["RB 1.A.99"] });
  const patch = join(root, "change.patch");
  await writeFile(patch, replacementPatch(before, after));
  const applied = await process.run({ command: ["git", "apply", patch], cwd: root });
  expect(applied.exitCode).toBe(0);
  expect(await readFile(join(root, BOOK_PATH), "utf8")).toBe(after);
  const stale = await process.run({ command: ["git", "apply", patch], cwd: root });
  expect(stale.exitCode).not.toBe(0);
  expect(await readFile(join(root, BOOK_PATH), "utf8")).toBe(after);
});
