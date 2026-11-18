import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { parseBook } from "./model";
import { announce } from "./records";
import { git, readRepository, readWorkingText, safePath, writeRepository } from "./repository";

export const bookCommands = {
  "book.import": defineCommand({
    id: "book.import",
    title: l10n("book.import", "Import a repository requirement book"),
    cli: true,
    mutating: true,
    params: {
      workspaceId: params.text(),
      path: params.text({ required: true }),
      expectedDigest: params.text({ required: true }),
    },
    async run(ctx, input) {
      if (!ctx.extensionFiles) throw new Error("Local extension files are unavailable.");
      const book = parseBook(await ctx.extensionFiles.readText(safePath(input.path)));
      const snapshot = await readRepository(ctx, input.workspaceId);
      if (snapshot.digest !== input.expectedDigest) throw new Error("The book changed. Reload before importing.");
      const requiredRetired = [
        ...(snapshot.book?.retired ?? []),
        ...(snapshot.book?.rules
          .filter((rule) => !book.rules.some((next) => next.ref === rule.ref))
          .map((rule) => rule.ref) ?? []),
      ];
      if (requiredRetired.some((ref) => !book.retired.includes(ref)))
        throw new Error(
          "Keep every previously retired or removed rule reference in retired; identities cannot be reused.",
        );
      const legacy = await git(ctx, snapshot.root, [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        "documentation/requirements",
      ]);
      if (legacy.exitCode) throw new Error(legacy.stderr.trim() || "Could not inspect existing requirements.");
      for (const path of legacy.stdout.trim().split("\n").filter(Boolean)) {
        if (await readWorkingText(ctx, snapshot.root, path))
          throw new Error(`Consolidate and remove the existing requirements authority before import: ${path}`);
      }
      const saved = await writeRepository(ctx, snapshot.workspaceId, snapshot.content, book);
      await announce(ctx, snapshot.workspaceId);
      return {
        workspaceId: saved.workspaceId,
        digest: saved.digest,
        chapters: book.chapters.length,
        rules: book.rules.length,
      };
    },
  }),
  "book.validate": defineCommand({
    id: "book.validate",
    title: l10n("book.validate", "Validate a complete requirement book"),
    cli: true,
    params: { path: params.text({ required: true }) },
    async run(ctx, input) {
      if (!ctx.extensionFiles) throw new Error("Local extension files are unavailable.");
      const book = parseBook(await ctx.extensionFiles.readText(safePath(input.path)));
      return {
        chapters: book.chapters.length,
        rules: book.rules.length,
        proposed: book.rules.filter((rule) => rule.status === "proposed").length,
      };
    },
  }),
};
