import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { ticketFilesDir, ticketMarkdownPath } from "../data/draft-storage";
import { parseTicketFrontmatter, stripFrontmatter } from "../data/frontmatter";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { makeCommandContext } from "./command-context.fixture";
import { listTicketFilesCommand } from "./list-ticket-files";
import { pullTicketCommand } from "./pull-ticket";
import { createMemoryRepoFiles } from "./repo-files.fixture";
import { saveTicketCommand } from "./save-ticket";
import { writeTicketCommand } from "./write-ticket";

const setup = async () => {
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  await seedDefaultTags(storage);
  const repoFiles = createMemoryRepoFiles();
  return { storage, repoFiles };
};

describe("draft workflow", () => {
  test("write creates a draft ticket and lays down ticket.md with frontmatter", async () => {
    const { storage, repoFiles } = await setup();

    const result = await writeTicketCommand.run(
      makeCommandContext({
        storage,
        params: { title: "Fix login", status: "TODO", tags: ["High"] },
        overrides: { repoFiles },
      }),
    );

    expect(result.shorthand).toBe("T-1");
    expect(result.path).toBe(ticketMarkdownPath("T-1"));

    const [ticket] = await ticketsCollection(storage).list();
    expect(ticket.draft).toBe(true);
    expect(ticket.statusId).toBe("ready");

    const markdown = repoFiles.files.get(ticketMarkdownPath("T-1"))!;
    const parsed = parseTicketFrontmatter(markdown);
    expect(parsed.draft).toBe(true);
    expect(parsed.tagNames).toEqual(["High"]);
    expect(stripFrontmatter(markdown)).toContain(`# ${ticket.title}`);
  });

  test("write uses the project shorthand in local ticket paths", async () => {
    const { storage, repoFiles } = await setup();

    const result = await writeTicketCommand.run(
      makeCommandContext({
        storage,
        params: { title: "Fix login" },
        overrides: {
          project: { id: "proj-1", name: "Prompt Studio", shorthand: "PS" },
          repoFiles,
        },
      }),
    );

    expect(result.shorthand).toBe("PS-1");
    expect(result.path).toBe(ticketMarkdownPath("PS-1"));
    expect(repoFiles.files.has(ticketMarkdownPath("PS-1"))).toBe(true);

    const [stored] = await ticketsCollection(storage).list();
    expect(stored.shorthand).toBe("PS-1");
  });

  test("write then save round-trips edits + frontmatter and clears the draft flag", async () => {
    const { storage, repoFiles } = await setup();

    const { shorthand } = await writeTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Original" }, overrides: { repoFiles } }),
    );

    // Simulate the user editing the body and adding a ticket file locally.
    repoFiles.files.set(
      ticketMarkdownPath(shorthand),
      [
        "---",
        'ticket_id: "T-1"',
        'created: "2026-01-01T00:00:00.000Z"',
        "draft: true",
        'tags: ["High"]',
        "---",
        "",
        "# Edited title",
        "",
        "Body text.",
      ].join("\n"),
    );
    repoFiles.files.set(`${ticketFilesDir(shorthand)}/notes.md`, "extra notes");

    const result = await saveTicketCommand.run(
      makeCommandContext({ storage, params: { id: shorthand }, overrides: { repoFiles } }),
    );

    expect(result.files).toBe(1);

    const saved = (await ticketsCollection(storage).get((await ticketsCollection(storage).list())[0].id))!;
    expect(saved.draft).toBe(false);
    expect(saved.title).toBe("Edited title");
    expect(saved.content).toContain("Body text.");
    expect(saved.tagIds).toEqual(["default-priority-high"]);
    expect(saved.files?.[0]?.name).toBe("notes.md");
    expect(saved.files?.[0]?.content).toBe("extra notes");
  });

  test("save resolves depends_on shorthands to ticket ids", async () => {
    const { storage, repoFiles } = await setup();

    const { shorthand: dependencyShorthand } = await writeTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Dependency" }, overrides: { repoFiles } }),
    );
    const { shorthand } = await writeTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Blocked ticket" }, overrides: { repoFiles } }),
    );

    repoFiles.files.set(
      ticketMarkdownPath(shorthand),
      [
        "---",
        `ticket_id: "${shorthand}"`,
        'created: "2026-01-01T00:00:00.000Z"',
        `depends_on: ["${dependencyShorthand}"]`,
        "---",
        "",
        "# Blocked ticket",
      ].join("\n"),
    );

    await saveTicketCommand.run(makeCommandContext({ storage, params: { id: shorthand }, overrides: { repoFiles } }));

    const tickets = await ticketsCollection(storage).list();
    const dependency = tickets.find((ticket) => ticket.shorthand === dependencyShorthand)!;
    const saved = tickets.find((ticket) => ticket.shorthand === shorthand)!;
    expect(saved.dependsOn).toEqual([dependency.id]);
  });

  test("save tolerates empty parent_id/blocked_reason frontmatter", async () => {
    const { storage, repoFiles } = await setup();
    const { shorthand } = await writeTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Lonely ticket" }, overrides: { repoFiles } }),
    );

    // Some writers emit empty quoted scalars for absent fields; saving must not
    // treat parent_id: "" as a reference to an unknown ticket.
    repoFiles.files.set(
      ticketMarkdownPath(shorthand),
      [
        "---",
        `ticket_id: "${shorthand}"`,
        'created: "2026-01-01T00:00:00.000Z"',
        'parent_id: ""',
        "depends_on: []",
        'blocked_reason: ""',
        "---",
        "",
        "# Lonely ticket",
      ].join("\n"),
    );

    await saveTicketCommand.run(makeCommandContext({ storage, params: { id: shorthand }, overrides: { repoFiles } }));

    const [saved] = await ticketsCollection(storage).list();
    expect(saved.draft).toBe(false);
    expect(saved.parentId ?? null).toBeNull();
    expect(saved.blockedReason).toBeNull();
  });

  test("pull materializes a stored ticket and its files into the working tree", async () => {
    const { storage, repoFiles } = await setup();
    const { shorthand } = await writeTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Seeded" }, overrides: { repoFiles } }),
    );
    const [stored] = await ticketsCollection(storage).list();
    await ticketsCollection(storage).put(stored.id, {
      ...stored,
      files: [{ id: "f1", name: "spec.md", content: "spec body", createdAt: "x", updatedAt: "x" }],
    });

    // Clear the working tree so pull has to recreate everything.
    repoFiles.files.clear();
    const result = (await pullTicketCommand.run(
      makeCommandContext({ storage, params: { id: shorthand }, overrides: { repoFiles } }),
    )) as { skipped: boolean };

    expect(result.skipped).toBe(false);
    const pulled = repoFiles.files.get(ticketMarkdownPath(shorthand))!;
    expect(pulled).toBeDefined();
    expect(stripFrontmatter(pulled)).toContain(`# ${stored.title}`);
    expect(repoFiles.files.get(`${ticketFilesDir(shorthand)}/spec.md`)).toBe("spec body");
  });

  test("pull without force does not clobber local edits", async () => {
    const { storage, repoFiles } = await setup();
    const { shorthand } = await writeTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Seeded" }, overrides: { repoFiles } }),
    );
    repoFiles.files.set(ticketMarkdownPath(shorthand), "local edits");

    const result = (await pullTicketCommand.run(
      makeCommandContext({ storage, params: { id: shorthand }, overrides: { repoFiles } }),
    )) as { skipped: boolean };

    expect(result.skipped).toBe(true);
    expect(repoFiles.files.get(ticketMarkdownPath(shorthand))).toBe("local edits");
  });

  test("files compares stored files against the local files directory", async () => {
    const { storage, repoFiles } = await setup();
    const { shorthand } = await writeTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Seeded" }, overrides: { repoFiles } }),
    );
    const [stored] = await ticketsCollection(storage).list();
    await ticketsCollection(storage).put(stored.id, {
      ...stored,
      files: [{ id: "f1", name: "only-storage.md", content: "x", createdAt: "x", updatedAt: "x" }],
    });
    repoFiles.files.set(`${ticketFilesDir(shorthand)}/only-local.md`, "y");

    const rows = await listTicketFilesCommand.run(
      makeCommandContext({ storage, params: { id: shorthand }, overrides: { repoFiles } }),
    );

    expect(rows).toEqual([
      { file: "only-local.md", storage: "no", local: "yes", path: `${ticketFilesDir(shorthand)}/only-local.md` },
      { file: "only-storage.md", storage: "yes", local: "no", path: `${ticketFilesDir(shorthand)}/only-storage.md` },
    ]);
  });
});
