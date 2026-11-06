import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { checkWorkspace } from "./checks";
import { evidenceCommands } from "./evidence-commands";
import { chapterSchema, emptyBook, findRule, ruleSchema } from "./model";
import { readBook, requireBook } from "./read";
import { announce, type Draft, deleteRecord, saveRecord } from "./records";
import { git, readRepository, readWorkingText, resolveWorkspace, writeRepository } from "./repository";
import { suggestionCommands } from "./suggestions";

export const commands = {
  ...suggestionCommands,
  ...evidenceCommands,
  "sources.read": defineCommand({
    id: "sources.read",
    title: "Inspect source evidence",
    cli: true,
    params: { workspaceId: params.text(), path: params.text({ required: true }) },
    async run(ctx, input) {
      const { root } = await resolveWorkspace(ctx, input.workspaceId);
      const content = await readWorkingText(ctx, root, input.path);
      if (content === null) throw new Error("Source is unavailable in this workspace.");
      return { path: input.path, content };
    },
  }),
  read: defineCommand({
    id: "read",
    title: l10n("book.read", "Read the requirement book"),
    cli: true,
    params: { workspaceId: params.text(), revision: params.text(), query: params.text() },
    run: (ctx, input) => readBook(ctx, { ...input, revision: input.revision === "accepted" ? "accepted" : "working" }),
  }),
  "workspace.select": defineCommand({
    id: "workspace.select",
    title: "Choose a book workspace",
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
    title: "Initialize a canonical book",
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
  "chapters.create": defineCommand({
    id: "chapters.create",
    title: "Add a book chapter",
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
  }),
  get: defineCommand({
    id: "get",
    title: "Retrieve a requirement",
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
        observations: data.observations.filter((item) => item.requirements.includes(rule.ref)),
        findings: data.findings.filter((item) => item.requirements.includes(rule.ref)),
      };
    },
  }),
  check: defineCommand({
    id: "check",
    title: l10n("book.check", "Check requirement evidence"),
    cli: true,
    mutating: true,
    params: { workspaceId: params.text() },
    run: (ctx, input) => checkWorkspace(ctx, input.workspaceId),
  }),
  "drafts.save": defineCommand({
    id: "drafts.save",
    title: "Save an authoring draft",
    cli: true,
    mutating: true,
    params: {
      workspaceId: params.text(),
      chapter: params.number({ required: true }),
      values: params.json<Record<string, unknown>, { required: true }>({ required: true }),
    },
    async run(ctx, input) {
      const { workspace } = await resolveWorkspace(ctx, input.workspaceId);
      const draft: Draft = {
        id: `${workspace.id}-${input.chapter}`,
        workspaceId: workspace.id,
        chapter: input.chapter,
        values: input.values,
      };
      await saveRecord(ctx.storage, "draft", draft);
      await announce(ctx, workspace.id);
      return draft;
    },
  }),
  "drafts.discard": defineCommand({
    id: "drafts.discard",
    title: "Discard an authoring draft",
    cli: true,
    mutating: true,
    params: { workspaceId: params.text(), chapter: params.number({ required: true }) },
    async run(ctx, input) {
      const { workspace } = await resolveWorkspace(ctx, input.workspaceId);
      await deleteRecord(ctx.storage, "draft", `${workspace.id}-${input.chapter}`);
      await announce(ctx, workspace.id);
      return { discarded: true };
    },
  }),
  "rules.validate": defineCommand({
    id: "rules.validate",
    title: "Validate a requirement",
    cli: true,
    params: { rule: params.json({ required: true }) },
    run: (_ctx, input) => ruleSchema.parse(input.rule),
  }),
};
