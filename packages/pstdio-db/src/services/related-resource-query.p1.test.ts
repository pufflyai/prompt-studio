import { expect, test } from "bun:test";
import { createDb } from "../db/connection.pglite";
import { createProjectsDBService } from "./projects/projects";
import { createResourceLinksDBService, writeResourceLinks } from "./resource-links";

test("related resources deduplicate before paging across both directions and preserve owner scopes", async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(db).create({ name: "Related" });
    const links = createResourceLinksDBService(db);
    const ticket = { projectId: project.id, extensionId: "example", type: "foobar", id: "one" };
    const second = { ...ticket, id: "two" };
    for (let index = 0; index < 105; index++) {
      const workspace = {
        ...ticket,
        extensionId: "pstdio",
        type: "workspace",
        id: String(index).padStart(3, "0"),
        label: `Workspace ${index}`,
      };
      await writeResourceLinks(db, workspace, [ticket, second]);
      await links.add(ticket, [workspace]);
    }
    await links.add(ticket, [{ ...ticket, extensionId: "other", type: "workspace" }]);
    const input = {
      resources: [ticket, second],
      direction: "both" as const,
      kind: "workspace",
      owner: "pstdio",
      limit: 100,
    };
    const first = await links.related(input);
    expect(first.items).toHaveLength(100);
    const secondPage = await links.related({ ...input, cursor: first.nextCursor! });
    expect(secondPage.items).toHaveLength(5);
    expect(new Set([...first.items, ...secondPage.items].map(({ id }) => id)).size).toBe(105);
    expect(secondPage.nextCursor).toBeNull();
    expect(first.items[0]).toMatchObject({ label: "Workspace 0", extensionId: "pstdio", projectId: project.id });
  } finally {
    await close();
  }
});
