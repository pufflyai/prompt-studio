import { describe, expect, mock, test } from "bun:test";
import { createTemplateService } from "./template-service";

describe("TemplateService", () => {
  test("list delegates to the DB service", async () => {
    const templates = [{ id: "t1", name: "default" }];
    const list = mock(async () => templates);
    const service = createTemplateService({
      templatesDBService: { list },
    } as unknown as Parameters<typeof createTemplateService>[0]);

    const result = await service.list("p1");

    expect(result as unknown).toBe(templates);
    expect(list).toHaveBeenCalledWith("p1");
  });
});
