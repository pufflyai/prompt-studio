import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandArgs } from "@pstdio/sdk/testing";
import { bookMenu } from "./book-menu";
import { BOOK_PATH, serializeBook } from "./model";
import { bookFixture } from "./model.fixture";
import { navigationView } from "./navigation";
import { readIndex } from "./read-index";
import { readRecord, saveRecord } from "./records";
import { resourceContributions } from "./resources";
import { reviewCommands } from "./review-commands";
import { suggestionCommands } from "./suggestions";

test("book review retains current labels, read counts and stored history", async () => {
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
      overrides: {
        projectId: "project",
        process: { run },
        workspaces: { getDefault: async () => workspace, list: async () => [workspace] } as never,
      },
    });
    const resolver = resourceContributions.find((item) => item.kind.id === "requirement")!.resolve;
    await saveRecord(storage, "finding", {
      id: "manual",
      workspaceId: "workspace",
      title: "Review mismatch",
      kind: "potential-conflict",
      explanation: "Needs review",
      requirements: [book.rules[0].ref],
      observations: ["archived-observation"],
      evidence: ["archived-result.log"],
      resolved: false,
      updatedAt: "now",
    });
    const sections = await navigationView.body.body(ctx);
    const findingNode = sections[0].nodes.find((node) => node.id === "Findings")!;
    expect(findingNode.label).toBe("Findings");
    expect("badge" in findingNode ? findingNode.badge : undefined).toEqual({ label: "1" });
    expect(sections[1].nodes[0].label).toBe("Workspaces");
    await reviewCommands["review.mark-read"].run(ctx, { ids: ["manual"] });
    expect((await readIndex(ctx)).counts.Findings).toBe(0);
    await reviewCommands["findings.save"].run(ctx, {
      id: "manual",
      title: "Reviewed mismatch",
      kind: "potential-conflict",
      explanation: "Reviewed",
      requirements: [book.rules[0].ref],
      resolved: true,
    });
    expect((await readRecord<{ evidence: string[] }>(storage, "finding", "manual")).value?.evidence).toEqual([
      "archived-result.log",
    ]);
    const operations = [
      { type: "AMEND" as const, before: book.rules[0], after: { ...book.rules[0], title: "Proposed" } },
    ];
    await saveRecord(storage, "suggestion", {
      id: "prior",
      workspaceId: "workspace",
      title: "Prior",
      reason: "Prior",
      baseRevision: "prior",
      operations,
      evidence: ["archived-result.log"],
      reviewedDigest: null,
      appliedRevision: null,
      createdAt: "now",
      updatedAt: "now",
    });
    await suggestionCommands.suggest.run(ctx, { id: "prior", title: "Revised", reason: "Revise intent", operations });
    expect((await readRecord<{ evidence: string[] }>(storage, "suggestion", "prior")).value?.evidence).toEqual([
      "archived-result.log",
    ]);
    commands.length = 0;
    const first = await resolver.run(ctx, { reference: book.rules[0].ref });
    expect(first?.label).toBe(book.rules[0].title);
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
