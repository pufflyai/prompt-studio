import { describe, expect, mock, test } from "bun:test";
import { createStatusService } from "./status-service";

describe("StatusService", () => {
  test("list delegates to the DB service", async () => {
    const statuses = [{ id: "s1", name: "Open" }];
    const list = mock(async () => statuses);
    const service = createStatusService({
      statusesDBService: { list },
    } as unknown as Parameters<typeof createStatusService>[0]);

    const result = await service.list("p1");

    expect(result as unknown).toBe(statuses);
    expect(list).toHaveBeenCalledWith("p1");
  });
});
