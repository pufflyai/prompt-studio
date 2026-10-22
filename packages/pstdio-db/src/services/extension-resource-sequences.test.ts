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
    await expect(service.allocate({ ...input, idPrefix: "INVALID" })).rejects.toThrow("ID prefix");
    const compact = await reopened.allocate({ ...input, idPrefix: "tk" });
    expect(compact.shorthand).toBe("PS-22");
    expect(compact.id).toMatch(/^tk_[0-9A-Za-z]{22}$/);
    expect(results[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
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
