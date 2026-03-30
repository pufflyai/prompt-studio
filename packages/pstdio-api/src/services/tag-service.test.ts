import { describe, expect, mock, test } from "bun:test";
import { createTagService } from "./tag-service";

describe("TagService", () => {
  test("list delegates to the DB service", async () => {
    const tags = [{ id: "t1", name: "bug" }];
    const list = mock(async () => tags);
    const service = createTagService({
      tagsDBService: { list },
    } as unknown as Parameters<typeof createTagService>[0]);

    const result = await service.list("p1");

    expect(result as unknown).toBe(tags);
    expect(list).toHaveBeenCalledWith("p1");
  });
});
