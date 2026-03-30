import { describe, expect, mock, test } from "bun:test";
import { createDocService } from "./doc-service";

describe("DocService", () => {
  test("getIndex resolves repo path and delegates to storage", async () => {
    const index = { sidebar: [] };
    const getIndex = mock(() => index);
    const listByProject = mock(async () => [{ path: "/repo" }]);

    const service = createDocService({
      docsStorageService: { getIndex, getDocument: mock() },
      reposDBService: { listByProject },
    } as unknown as Parameters<typeof createDocService>[0]);

    const result = await service.getIndex("p1");

    expect(result as unknown).toBe(index);
    expect(listByProject).toHaveBeenCalledWith("p1");
    expect(getIndex).toHaveBeenCalledWith("/repo");
  });

  test("getIndex throws when no repo is linked", async () => {
    const listByProject = mock(async () => []);

    const service = createDocService({
      docsStorageService: { getIndex: mock(), getDocument: mock() },
      reposDBService: { listByProject },
    } as unknown as Parameters<typeof createDocService>[0]);

    expect(service.getIndex("p1")).rejects.toThrow("No repo linked");
  });
});
