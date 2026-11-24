import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { z } from "zod";
import { draftCommands, submitDraft } from "./draft-commands";
import { acceptanceConditions, draftChapterFor, splitRefs } from "./forms";
import { bookCommands } from "./import";
import {
  chapterSchema,
  createRuleReference,
  emptyBook,
  findRule,
  type Operation,
  operationIssues,
  ruleSchema,
} from "./model";
import { readBook, requireBook } from "./read";
import { announce } from "./records";
import { git, readRepository, resolveWorkspace, writeRepository } from "./repository";
import { reviewCommands, saveFinding } from "./review-commands";
import { saveSuggestion, suggestionCommands } from "./suggestions";

const createChapter = defineCommand({
  id: "chapters.create",
  title: l10n("book.chapter.add", "Add a book chapter"),
  cli: true,
  mutating: true,
  params: {
    workspaceId: params.text(),
    title: params.text({ required: true }),
    group: params.text({ required: true }),
  },
  async run(ctx, input) {
    const snapshot = await readRepository(ctx, input.workspaceId);
    const book = requireBook(snapshot.book);
    const nextId = Math.max(0, ...book.chapters.map((item) => item.id)) + 1;
    const chapter = chapterSchema.parse({ id: nextId, title: input.title, group: input.group });
    await writeRepository(ctx, snapshot.workspaceId, snapshot.content, {
      ...book,
      chapters: [...book.chapters, chapter],
    });
    await announce(ctx, snapshot.workspaceId);
    return chapter;
  },
});

export const commands = {
  ...suggestionCommands,
  ...bookCommands,
  ...reviewCommands,
  ...draftCommands,
  read: defineCommand({
    id: "read",
    title: l10n("book.read", "Read the requirement book"),
    cli: true,
    params: { workspaceId: params.text(), revision: params.text(), query: params.text() },
    run: (ctx, input) => readBook(ctx, { ...input, revision: input.revision === "accepted" ? "accepted" : "working" }),
  }),
  "workspace.select": defineCommand({
    id: "workspace.select",
    title: l10n("book.workspace.select", "Choose a book workspace"),
    cli: true,
    mutating: true,
    params: { workspaceId: params.text({ required: true }) },
    async run(ctx, input) {
      await resolveWorkspace(ctx, input.workspaceId);
      await ctx.settings.set("workspaceId", input.workspaceId);
      await announce(ctx, input.workspaceId);
      return readBook(ctx, input);
    },
  }),
  initialize: defineCommand({
    id: "initialize",
    title: l10n("book.initialize", "Initialize a canonical book"),
    cli: true,
    mutating: true,
    params: { workspaceId: params.text(), title: params.text({ required: true }) },
    async run(ctx, input) {
      const snapshot = await readRepository(ctx, input.workspaceId);
      if (snapshot.book) throw new Error("A canonical book already exists.");
      const legacy = await git(ctx, snapshot.root, ["ls-files", "--", "documentation/requirements"]);
      if (legacy.stdout.trim())
        throw new Error(
          "This repository already has requirements. Consolidate and remove their old authority in the same migration before initializing its canonical book.",
        );
      const book = { ...emptyBook(), chapters: [{ id: 1, title: input.title, group: "Core" as const }] };
      await writeRepository(ctx, snapshot.workspaceId, null, book);
      await announce(ctx, snapshot.workspaceId);
      return readBook(ctx, { workspaceId: snapshot.workspaceId });
    },
  }),
  "chapters.create": createChapter,
  "drafts.submit": defineCommand({
    id: "drafts.submit",
    title: l10n("book.draft.submit", "Submit an authoring draft"),
    mutating: true,
    params: {
      workspaceId: params.text({ required: true }),
      chapter: params.number({ required: true }),
      mode: params.text({ required: true }),
      expectedRevision: params.text({ required: true }),
      values: params.json<Record<string, unknown>, { required: true }>({ required: true }),
    },
    async run(ctx, input) {
      const mode = z.enum(["rule", "finding", "chapter"]).parse(input.mode);
      const snapshot = await readRepository(ctx, input.workspaceId);
      const book = requireBook(snapshot.book);
      const workspaceId = snapshot.workspaceId;
      const { values, chapter } = input;
      const draft = {
        workspaceId,
        chapter: draftChapterFor(mode, chapter),
        values,
        expectedRevision: input.expectedRevision,
        invocationId: ctx.invocationId,
      };
      if (mode === "chapter") {
        const { title, group } = chapterSchema.omit({ id: true }).parse(values);
        return submitDraft(ctx, draft, async () => createChapter.run(ctx, { workspaceId, title, group }));
      }
      if (mode === "finding") {
        const finding = z
          .object({
            kind: z.enum(["violation", "potential-conflict", "missing-evidence", "stale-evidence"]),
            title: z.string().trim().min(1),
            explanation: z.string().trim().min(1),
          })
          .parse(values);
        const requirements = splitRefs(values.requirements);
        const missing = requirements.find((ref) => !findRule(book.rules, ref));
        if (missing) return { refused: { reason: `Unknown requirement ${missing}`, revision: input.expectedRevision } };
        const id = ctx.storage.ids.create();
        return submitDraft(ctx, { ...draft, proof: { kind: "finding", id } }, async () =>
          saveFinding(ctx, { ...finding, workspaceId, requirements }, id),
        );
      }
      const target = book.chapters.find((item) => item.id === chapter);
      if (!target) throw new Error("Choose an existing chapter.");
      const rule = ruleSchema.parse({
        ref: createRuleReference(target),
        chapter,
        level: 2,
        title: values.title,
        statement: values.statement,
        rationale: "",
        status: "proposed",
        section: "Behavior",
        acceptance: acceptanceConditions(values.acceptance),
        related: splitRefs(values.related),
        governing: [],
      });
      const reason = z.string().trim().min(1).parse(values.reason);
      const operations: Operation[] = [{ type: "ADD", before: null, after: rule }];
      const issues = operationIssues(book, operations);
      if (issues.length) return { refused: { reason: issues.join("\n"), revision: input.expectedRevision } };
      const id = ctx.storage.ids.create();
      return submitDraft(ctx, { ...draft, proof: { kind: "suggestion", id } }, async () =>
        saveSuggestion(
          ctx,
          {
            workspaceId,
            title: `Add ${rule.title}`,
            reason,
            operations,
          },
          id,
        ),
      );
    },
  }),
  get: defineCommand({
    id: "get",
    title: l10n("book.rule.get", "Retrieve a requirement"),
    cli: true,
    params: { workspaceId: params.text(), reference: params.text({ required: true }), revision: params.text() },
    async run(ctx, input) {
      const data = await readBook(ctx, { ...input, revision: input.revision === "accepted" ? "accepted" : "working" });
      const rule = findRule(data.rules, input.reference);
      if (!rule) throw new Error(`Requirement not found: ${input.reference}`);
      return {
        rule,
        head: data.head,
        revision: data.revision,
        findings: data.findings.filter((item) => item.requirements.includes(rule.ref)),
      };
    },
  }),

  "rules.validate": defineCommand({
    id: "rules.validate",
    title: l10n("book.rule.validate", "Validate a requirement"),
    cli: true,
    params: { rule: params.json({ required: true }) },
    run: (_ctx, input) => ruleSchema.parse(input.rule),
  }),
};
