import { describe, expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { ticketFilesDir, ticketMarkdownPath } from "../data/draft-storage";
import { parseTicketFrontmatter, stripFrontmatter } from "../data/frontmatter";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { makeCommandArgs } from "./command-context.fixture";
import { listTicketFilesCommand } from "./list-ticket-files";
import { pullTicketCommand } from "./pull-ticket";
import { saveTicketCommand } from "./save-ticket";
import { writeTicketCommand } from "./write-ticket";

const setup = async () => {
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  await seedDefaultTags(storage);
  const projectFiles = createMemoryRepoFiles();
  return { storage, projectFiles };
};

describe("draft workflow", () => {
  test("write creates a draft ticket and lays down ticket.md with frontmatter", async () => {
    const { storage, projectFiles } = await setup();

    const result = await writeTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { title: "Fix login", status: "TODO", tags: ["High"] },
        overrides: { projectFiles },
      }),
    );

    expect(result.shorthand).toBe("T-1");
    expect(result.path).toBe(ticketMarkdownPath("T-1"));

    const [ticket] = await ticketsCollection(storage).list();
    expect(ticket.draft).toBe(true);
    expect(ticket.statusId).toBe("ready");

    const markdown = await projectFiles.readText(ticketMarkdownPath("T-1"))!;
    const parsed = parseTicketFrontmatter(markdown);
    expect(parsed.draft).toBe(true);
    expect(parsed.tagNames).toEqual(["High"]);
    expect(stripFrontmatter(markdown)).toContain(`# ${ticket.title}`);
  });

  test("write uses the project shorthand in local ticket paths", async () => {
    const { storage, projectFiles } = await setup();

    const result = await writeTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { title: "Fix login" },
        overrides: {
          project: { id: "proj-1", name: "Prompt Studio", shorthand: "PS" },
          projectFiles,
        },
      }),
    );

    expect(result.shorthand).toBe("PS-1");
    expect(result.path).toBe(ticketMarkdownPath("PS-1"));
    expect(projectFiles.files.has(ticketMarkdownPath("PS-1"))).toBe(true);

    const [stored] = await ticketsCollection(storage).list();
    expect(stored.shorthand).toBe("PS-1");
  });

  test("write then save round-trips edits + frontmatter and clears the draft flag", async () => {
    const { storage, projectFiles } = await setup();

    const { shorthand } = await writeTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Original" }, overrides: { projectFiles } }),
    );

    // Simulate the user editing the body and adding a ticket file locally.
    await projectFiles.writeText(
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
    await projectFiles.writeText(`${ticketFilesDir(shorthand)}/notes.md`, "extra notes");

    const result = await saveTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: shorthand }, overrides: { projectFiles } }),
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
    const { storage, projectFiles } = await setup();

    const { shorthand: dependencyShorthand } = await writeTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Dependency" }, overrides: { projectFiles } }),
    );
    const { shorthand } = await writeTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Blocked ticket" }, overrides: { projectFiles } }),
    );

    await projectFiles.writeText(
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

    await saveTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: shorthand }, overrides: { projectFiles } }),
    );

    const tickets = await ticketsCollection(storage).list();
    const dependency = tickets.find((ticket) => ticket.shorthand === dependencyShorthand)!;
    const saved = tickets.find((ticket) => ticket.shorthand === shorthand)!;
    expect(saved.dependsOn).toEqual([dependency.id]);
  });

  test("save tolerates empty parent_id/blocked_reason frontmatter", async () => {
    const { storage, projectFiles } = await setup();
    const { shorthand } = await writeTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Lonely ticket" }, overrides: { projectFiles } }),
    );

    // Some writers emit empty quoted scalars for absent fields; saving must not
    // treat parent_id: "" as a reference to an unknown ticket.
    await projectFiles.writeText(
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

    await saveTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: shorthand }, overrides: { projectFiles } }),
    );

    const [saved] = await ticketsCollection(storage).list();
    expect(saved.draft).toBe(false);
    expect(saved.parentId ?? null).toBeNull();
    expect(saved.blockedReason).toBeNull();
  });

  test("pull materializes a stored ticket and its files into the working tree", async () => {
    const { storage, projectFiles } = await setup();
    const { shorthand } = await writeTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Seeded" }, overrides: { projectFiles } }),
    );
    const [stored] = await ticketsCollection(storage).list();
    await ticketsCollection(storage).put(stored.id, {
      ...stored,
      files: [{ id: "f1", name: "spec.md", content: "spec body", createdAt: "x", updatedAt: "x" }],
    });

    // Clear the working tree so pull has to recreate everything.
    projectFiles.files.clear();
    const result = (await pullTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: shorthand }, overrides: { projectFiles } }),
    )) as { skipped: boolean };

    expect(result.skipped).toBe(false);
    const pulled = await projectFiles.readText(ticketMarkdownPath(shorthand))!;
    expect(pulled).toBeDefined();
    expect(stripFrontmatter(pulled)).toContain(`# ${stored.title}`);
    expect(await projectFiles.readText(`${ticketFilesDir(shorthand)}/spec.md`)).toBe("spec body");
  });

  test("pull without force does not clobber local edits", async () => {
    const { storage, projectFiles } = await setup();
    const { shorthand } = await writeTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Seeded" }, overrides: { projectFiles } }),
    );
    await projectFiles.writeText(ticketMarkdownPath(shorthand), "local edits");

    const result = (await pullTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: shorthand }, overrides: { projectFiles } }),
    )) as { skipped: boolean };

    expect(result.skipped).toBe(true);
    expect(await projectFiles.readText(ticketMarkdownPath(shorthand))).toBe("local edits");
  });

  test("files compares stored files against the local files directory", async () => {
    const { storage, projectFiles } = await setup();
    const { shorthand } = await writeTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Seeded" }, overrides: { projectFiles } }),
    );
    const [stored] = await ticketsCollection(storage).list();
    await ticketsCollection(storage).put(stored.id, {
      ...stored,
      files: [{ id: "f1", name: "only-storage.md", content: "x", createdAt: "x", updatedAt: "x" }],
    });
    await projectFiles.writeText(`${ticketFilesDir(shorthand)}/only-local.md`, "y");

    const rows = await listTicketFilesCommand.run(
      ...makeCommandArgs({ storage, params: { id: shorthand }, overrides: { projectFiles } }),
    );

    expect(rows).toEqual([
      { file: "only-local.md", storage: "no", local: "yes", path: `${ticketFilesDir(shorthand)}/only-local.md` },
      { file: "only-storage.md", storage: "yes", local: "no", path: `${ticketFilesDir(shorthand)}/only-storage.md` },
    ]);
  });
});
