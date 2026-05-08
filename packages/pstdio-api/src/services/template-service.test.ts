import { describe, expect, mock, test } from "bun:test";
import { createTemplateService } from "./template-service";

describe("TemplateService", () => {
  test("list returns project templates when no extensions are enabled", async () => {
    const templates = [
      {
        id: "t1",
        project_id: "p1",
        name: "default",
        template_type: "prompt",
        file_id: "f1",
        is_default: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
    ];
    const list = mock(async () => templates);
    const service = createTemplateService({
      templatesDBService: { list },
      extensionService: { listEnabledSourcesForProject: mock(async () => []) },
      extensionTemplatePreferencesDBService: { list: mock(async () => []) },
      projectTemplateDefaultsDBService: { list: mock(async () => []) },
    } as unknown as Parameters<typeof createTemplateService>[0]);

    const result = await service.list("p1");

    expect(result[0]).toMatchObject({ id: "t1", source_kind: "project", title: "default" });
    expect(list).toHaveBeenCalledWith("p1");
  });
});
