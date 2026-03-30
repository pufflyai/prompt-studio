import { afterAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { ticket_tag_options, ticket_tags } from "../../db/schemas.pg";
import { createProjectsDBService } from "../projects/projects";
import { createTicketsDBService } from "./tickets";

let close: () => Promise<void>;
let ticketsService: ReturnType<typeof createTicketsDBService>;
let projectId: string;
let bugOptionId: string;
let featureOptionId: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;

  const projectsService = createProjectsDBService(result.db);
  const project = await projectsService.create({ name: "prompt-studio" });
  projectId = project.id;

  const [labelTag] = await result.db.select().from(ticket_tags).where(eq(ticket_tags.project_id, projectId));
  const options = await result.db.select().from(ticket_tag_options).where(eq(ticket_tag_options.tag_id, labelTag.id));
  bugOptionId = options.find((o) => o.name === "bug")!.id;
  featureOptionId = options.find((o) => o.name === "feature")!.id;

  ticketsService = createTicketsDBService(result.db);
};

afterAll(async () => {
  await close?.();
});

describe("createTicketsDBService", () => {
  test("creates a ticket with auto-generated shorthand", async () => {
    await setup();

    const ticket = await ticketsService.create({ project_id: projectId, display_title: "First ticket" });

    expect(ticket.shorthand).toBe("PS-1");
    expect(ticket.display_title).toBe("First ticket");
    expect(ticket.project_id).toBe(projectId);
    expect(ticket.draft).toBe(false);
    expect(ticket.archived).toBe(false);
  });

  test("generates monotonically increasing shorthands", async () => {
    await setup();

    const t1 = await ticketsService.create({ project_id: projectId, display_title: "One" });
    const t2 = await ticketsService.create({ project_id: projectId, display_title: "Two" });
    const t3 = await ticketsService.create({ project_id: projectId, display_title: "Three" });

    expect(t1.shorthand).toBe("PS-1");
    expect(t2.shorthand).toBe("PS-2");
    expect(t3.shorthand).toBe("PS-3");
  });

  test("creates a draft ticket", async () => {
    await setup();

    const ticket = await ticketsService.create({ project_id: projectId, display_title: "Draft", draft: true });

    expect(ticket.draft).toBe(true);
  });

  test("get returns ticket by id", async () => {
    await setup();

    const created = await ticketsService.create({ project_id: projectId, display_title: "Get me" });
    const fetched = await ticketsService.get(created.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
  });

  test("get returns null for non-existent id", async () => {
    await setup();

    const result = await ticketsService.get("non-existent");
    expect(result).toBeNull();
  });

  test("getByShorthand returns ticket by project and shorthand", async () => {
    await setup();

    const created = await ticketsService.create({ project_id: projectId, display_title: "Find me" });
    const fetched = await ticketsService.getByShorthand(projectId, created.shorthand);

    expect(fetched).not.toBeNull();
    expect(fetched!.shorthand).toBe(created.shorthand);
  });

  test("list returns non-draft tickets by default, including archived", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, display_title: "Active" });
    await ticketsService.create({ project_id: projectId, display_title: "Draft", draft: true });
    const archived = await ticketsService.create({ project_id: projectId, display_title: "Archived" });
    await ticketsService.update(archived.id, { archived: true });

    const results = await ticketsService.list(projectId);

    expect(results.length).toBe(2);
    expect(results.map((r) => r.display_title).sort()).toEqual(["Active", "Archived"]);
  });

  test("list with archived=false returns only non-archived tickets", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, display_title: "Active" });
    const archived = await ticketsService.create({ project_id: projectId, display_title: "Archived" });
    await ticketsService.update(archived.id, { archived: true });

    const results = await ticketsService.list(projectId, { archived: false });

    expect(results.length).toBe(1);
    expect(results[0].display_title).toBe("Active");
  });

  test("list with archived=true returns only archived tickets", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, display_title: "Active" });
    const archived = await ticketsService.create({ project_id: projectId, display_title: "Archived" });
    await ticketsService.update(archived.id, { archived: true });

    const results = await ticketsService.list(projectId, { archived: true });

    expect(results.length).toBe(1);
    expect(results[0].display_title).toBe("Archived");
  });

  test("list with draft=true returns draft tickets", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, display_title: "Normal" });
    await ticketsService.create({ project_id: projectId, display_title: "Draft", draft: true });

    const results = await ticketsService.list(projectId, { draft: true });

    expect(results.length).toBe(1);
    expect(results[0].display_title).toBe("Draft");
  });

  test("list filters by parent_id", async () => {
    await setup();

    const parent = await ticketsService.create({ project_id: projectId, display_title: "Parent" });
    await ticketsService.create({ project_id: projectId, display_title: "Child", parent_id: parent.shorthand });
    await ticketsService.create({ project_id: projectId, display_title: "Unrelated" });

    const results = await ticketsService.list(projectId, { parent_id: parent.shorthand });

    expect(results.length).toBe(1);
    expect(results[0].display_title).toBe("Child");
  });

  test("list filters by search term across title and prompt", async () => {
    await setup();

    await ticketsService.create({
      project_id: projectId,
      display_title: "Improve search ranking",
      user_prompt: "Tune BM25 scoring",
    });
    await ticketsService.create({
      project_id: projectId,
      display_title: "Refactor authentication",
      user_prompt: "Fix token refresh edge case",
    });

    const titleMatches = await ticketsService.list(projectId, { search: "ranking" });
    const promptMatches = await ticketsService.list(projectId, { search: "token refresh" });

    expect(titleMatches.length).toBe(1);
    expect(titleMatches[0].display_title).toBe("Improve search ranking");
    expect(promptMatches.length).toBe(1);
    expect(promptMatches[0].display_title).toBe("Refactor authentication");
  });

  test("update modifies ticket fields", async () => {
    await setup();

    const created = await ticketsService.create({ project_id: projectId, display_title: "Before" });
    await Bun.sleep(5);
    const updated = await ticketsService.update(created.id, { display_title: "After" });

    expect(updated).not.toBeNull();
    expect(updated!.display_title).toBe("After");
    expect(updated!.updated_at).not.toBe(created.updated_at);
  });

  test("update returns null for non-existent ticket", async () => {
    await setup();

    const result = await ticketsService.update("non-existent", { display_title: "Nope" });
    expect(result).toBeNull();
  });

  test("stores user_prompt only when provided", async () => {
    await setup();

    const withPrompt = await ticketsService.create({
      project_id: projectId,
      display_title: "With prompt",
      user_prompt: "Please fix the login bug",
    });
    const withoutPrompt = await ticketsService.create({
      project_id: projectId,
      display_title: "Without prompt",
    });

    expect(withPrompt.user_prompt).toBe("Please fix the login bug");
    expect(withoutPrompt.user_prompt).toBeNull();
  });

  test("assignTagOptions and getTagOptionAssignments round-trip", async () => {
    await setup();

    const ticket = await ticketsService.create({ project_id: projectId, display_title: "Tagged" });
    await ticketsService.assignTagOptions(ticket.id, [bugOptionId, featureOptionId]);

    const options = await ticketsService.getTagOptionAssignments(ticket.id);

    expect(options.length).toBe(2);
    expect(options.map((o) => o.name).sort()).toEqual(["bug", "feature"]);
  });

  test("assignTagOptions replaces existing options", async () => {
    await setup();

    const ticket = await ticketsService.create({ project_id: projectId, display_title: "Re-tagged" });
    await ticketsService.assignTagOptions(ticket.id, [bugOptionId, featureOptionId]);
    await ticketsService.assignTagOptions(ticket.id, [bugOptionId]);

    const options = await ticketsService.getTagOptionAssignments(ticket.id);

    expect(options.length).toBe(1);
    expect(options[0].name).toBe("bug");
  });
});
