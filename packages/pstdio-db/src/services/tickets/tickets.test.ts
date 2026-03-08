import { afterAll, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { createDb, type DbClient } from "../../db/connection.pglite";
import { ticket_tags } from "../../db/schemas.pg";
import { createProjectsService } from "../projects/projects";
import { createTicketsService } from "./tickets";

let close: () => Promise<void>;
let db: DbClient;
let ticketsService: ReturnType<typeof createTicketsService>;
let projectId: string;
let bugTagId: string;
let featureTagId: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;
  db = result.db;

  const projectsService = createProjectsService(result.db);
  const project = await projectsService.create({ name: "prompt-studio" });
  projectId = project.id;

  const tags = await result.db.select().from(ticket_tags).where(eq(ticket_tags.project_id, projectId));
  bugTagId = tags.find((t) => t.name === "bug")!.id;
  featureTagId = tags.find((t) => t.name === "feature")!.id;

  ticketsService = createTicketsService(result.db);
};

afterAll(async () => {
  await close?.();
});

describe("createTicketsService", () => {
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

  test("list returns non-draft, non-archived tickets by default", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, display_title: "Visible" });
    await ticketsService.create({ project_id: projectId, display_title: "Draft", draft: true });

    const results = await ticketsService.list(projectId);

    expect(results.length).toBe(1);
    expect(results[0].display_title).toBe("Visible");
  });

  test("list with draft=true returns draft tickets", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, display_title: "Normal" });
    await ticketsService.create({ project_id: projectId, display_title: "Draft", draft: true });

    const results = await ticketsService.list(projectId, { draft: true });

    expect(results.length).toBe(1);
    expect(results[0].display_title).toBe("Draft");
  });

  test("list filters by priority", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, display_title: "P1", priority: "P1" });
    await ticketsService.create({ project_id: projectId, display_title: "P2", priority: "P2" });

    const results = await ticketsService.list(projectId, { priority: "P1" });

    expect(results.length).toBe(1);
    expect(results[0].display_title).toBe("P1");
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

  test("assignTags and getTagAssignments round-trip", async () => {
    await setup();

    const ticket = await ticketsService.create({ project_id: projectId, display_title: "Tagged" });
    await ticketsService.assignTags(ticket.id, [bugTagId, featureTagId]);

    const tags = await ticketsService.getTagAssignments(ticket.id);

    expect(tags.length).toBe(2);
    expect(tags.map((t) => t.name).sort()).toEqual(["bug", "feature"]);
  });

  test("assignTags replaces existing tags", async () => {
    await setup();

    const ticket = await ticketsService.create({ project_id: projectId, display_title: "Re-tagged" });
    await ticketsService.assignTags(ticket.id, [bugTagId, featureTagId]);
    await ticketsService.assignTags(ticket.id, [bugTagId]);

    const tags = await ticketsService.getTagAssignments(ticket.id);

    expect(tags.length).toBe(1);
    expect(tags[0].name).toBe("bug");
  });

  test("rejects invalid complexity values at DB layer", async () => {
    await setup();

    const ticket = await ticketsService.create({
      project_id: projectId,
      display_title: "Complexity guard",
      complexity: "low",
    });

    await expect(
      db.execute(sql`update tickets set complexity = ${"not_a_real_complexity"} where id = ${ticket.id}`).execute(),
    ).rejects.toThrow();
  });
});
