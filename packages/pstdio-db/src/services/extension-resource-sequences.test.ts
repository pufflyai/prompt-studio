import { expect, test } from "bun:test";
import { createDb } from "../db/connection.pglite";
import { createExtensionResourceSequencesDBService } from "./extension-resource-sequences";
import { createProjectsDBService } from "./projects/projects";

test("resource identities remain unique across concurrent allocations and service restarts", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Prompt Studio" });
    const service = createExtensionResourceSequencesDBService(connection.db);
    const input = { projectId: project.id, extensionId: "pstdio.planner", kind: "ticket", prefix: "PS" };
    const results = await Promise.all(Array.from({ length: 20 }, () => service.allocate(input)));
    expect(new Set(results.map((result) => result.shorthand)).size).toBe(20);
    expect(new Set(results.map((result) => result.id)).size).toBe(20);
    const reopened = createExtensionResourceSequencesDBService(connection.db);
    expect((await reopened.allocate(input)).shorthand).toBe("PS-21");
    expect(
      (await service.allocate({ ...input, extensionId: "pstdio.reports", kind: "report", prefix: "RP" })).shorthand,
    ).toBe("RP-1");
    await expect(service.allocate({ ...input, extensionId: "pstdio.other" })).rejects.toThrow("pstdio.planner");
    const other = await createProjectsDBService(connection.db).create({ name: "Other" });
    expect((await service.allocate({ ...input, projectId: other.id })).shorthand).toBe("PS-1");
  } finally {
    await connection.close();
  }
});
