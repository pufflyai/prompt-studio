import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DbClient } from "../../db/connection.pglite";
import { createDb } from "../../db/connection.pglite";
import { createProjectsDBService } from "../projects/projects";
import { createExtensionTemplatePreferencesDBService } from "./extension-template-preferences";

let db: DbClient;
let close: () => Promise<void>;
let service: ReturnType<typeof createExtensionTemplatePreferencesDBService>;
let projectId: string;

beforeEach(async () => {
  const conn = await createDb({ path: ":memory:" });
  db = conn.db;
  close = conn.close;

  const projects = createProjectsDBService(db);
  const project = await projects.create({ name: "test-project" });
  projectId = project.id;

  service = createExtensionTemplatePreferencesDBService(db);
});

afterEach(async () => {
  await close();
});

describe("extension-template-preferences service", () => {
  test("isEnabled defaults to true when no row exists", async () => {
    const enabled = await service.isEnabled(projectId, "pstdio.planner", "ticket-template");
    expect(enabled).toBe(true);
  });

  test("setEnabled persists the explicit value", async () => {
    await service.setEnabled({
      project_id: projectId,
      extension_id: "pstdio.planner",
      template_key: "ticket-template",
      enabled: false,
    });

    expect(await service.isEnabled(projectId, "pstdio.planner", "ticket-template")).toBe(false);

    await service.setEnabled({
      project_id: projectId,
      extension_id: "pstdio.planner",
      template_key: "ticket-template",
      enabled: true,
    });

    expect(await service.isEnabled(projectId, "pstdio.planner", "ticket-template")).toBe(true);
  });

  test("listByExtension returns explicit overrides only", async () => {
    await service.setEnabled({
      project_id: projectId,
      extension_id: "pstdio.planner",
      template_key: "ticket-template",
      enabled: false,
    });

    const all = await service.listByExtension(projectId, "pstdio.planner");
    expect(all).toHaveLength(1);
    expect(all[0].template_key).toBe("ticket-template");
    expect(all[0].enabled).toBe(false);
  });
});
