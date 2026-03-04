import { afterAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { ticket_tags } from "../../db/schemas.pg";
import { createProjectsService } from "../projects/projects";
import { createTicketsService } from "./tickets";

let close: () => Promise<void>;
let ticketsService: ReturnType<typeof createTicketsService>;
let projectId: string;
let bugTagId: string;
let featureTagId: string;

const setup = async () => {
  const result = await createDb({ path: ":memory:" });
  close = result.close;

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

    const ticket = await ticketsService.create({ project_id: projectId, title: "First ticket" });

    expect(ticket.shorthand).toBe("PS-1");
    expect(ticket.title).toBe("First ticket");
    expect(ticket.project_id).toBe(projectId);
    expect(ticket.draft).toBe(false);
    expect(ticket.archived).toBe(false);
  });

  test("generates monotonically increasing shorthands", async () => {
    await setup();

    const t1 = await ticketsService.create({ project_id: projectId, title: "One" });
    const t2 = await ticketsService.create({ project_id: projectId, title: "Two" });
    const t3 = await ticketsService.create({ project_id: projectId, title: "Three" });

    expect(t1.shorthand).toBe("PS-1");
    expect(t2.shorthand).toBe("PS-2");
    expect(t3.shorthand).toBe("PS-3");
  });

  test("creates a draft ticket", async () => {
    await setup();

    const ticket = await ticketsService.create({ project_id: projectId, title: "Draft", draft: true });

    expect(ticket.draft).toBe(true);
  });

  test("get returns ticket by id", async () => {
    await setup();

    const created = await ticketsService.create({ project_id: projectId, title: "Get me" });
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

    const created = await ticketsService.create({ project_id: projectId, title: "Find me" });
    const fetched = await ticketsService.getByShorthand(projectId, created.shorthand);

    expect(fetched).not.toBeNull();
    expect(fetched!.shorthand).toBe(created.shorthand);
  });

  test("list returns non-draft, non-archived tickets by default", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, title: "Visible" });
    await ticketsService.create({ project_id: projectId, title: "Draft", draft: true });

    const results = await ticketsService.list(projectId);

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Visible");
  });

  test("list with draft=true returns draft tickets", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, title: "Normal" });
    await ticketsService.create({ project_id: projectId, title: "Draft", draft: true });

    const results = await ticketsService.list(projectId, { draft: true });

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Draft");
  });

  test("list filters by priority", async () => {
    await setup();

    await ticketsService.create({ project_id: projectId, title: "P1", priority: "P1" });
    await ticketsService.create({ project_id: projectId, title: "P2", priority: "P2" });

    const results = await ticketsService.list(projectId, { priority: "P1" });

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("P1");
  });

  test("list filters by parent_id", async () => {
    await setup();

    const parent = await ticketsService.create({ project_id: projectId, title: "Parent" });
    await ticketsService.create({ project_id: projectId, title: "Child", parent_id: parent.shorthand });
    await ticketsService.create({ project_id: projectId, title: "Unrelated" });

    const results = await ticketsService.list(projectId, { parent_id: parent.shorthand });

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Child");
  });

  test("update modifies ticket fields", async () => {
    await setup();

    const created = await ticketsService.create({ project_id: projectId, title: "Before" });
    const updated = await ticketsService.update(created.id, { title: "After" });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe("After");
    expect(updated!.updated_at).not.toBe(created.updated_at);
  });

  test("update returns null for non-existent ticket", async () => {
    await setup();

    const result = await ticketsService.update("non-existent", { title: "Nope" });
    expect(result).toBeNull();
  });

  test("assignTags and getTagAssignments round-trip", async () => {
    await setup();

    const ticket = await ticketsService.create({ project_id: projectId, title: "Tagged" });
    await ticketsService.assignTags(ticket.id, [bugTagId, featureTagId]);

    const tags = await ticketsService.getTagAssignments(ticket.id);

    expect(tags.length).toBe(2);
    expect(tags.map((t) => t.name).sort()).toEqual(["bug", "feature"]);
  });

  test("assignTags replaces existing tags", async () => {
    await setup();

    const ticket = await ticketsService.create({ project_id: projectId, title: "Re-tagged" });
    await ticketsService.assignTags(ticket.id, [bugTagId, featureTagId]);
    await ticketsService.assignTags(ticket.id, [bugTagId]);

    const tags = await ticketsService.getTagAssignments(ticket.id);

    expect(tags.length).toBe(1);
    expect(tags[0].name).toBe("bug");
  });
});
