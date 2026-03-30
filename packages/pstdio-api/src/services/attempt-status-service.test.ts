import { describe, expect, mock, test } from "bun:test";
import { createAttemptStatusService } from "./attempt-status-service";

describe("AttemptStatusService", () => {
  test("list delegates to the DB service", async () => {
    const statuses = [{ id: "as1", name: "pending" }];
    const list = mock(async () => statuses);
    const service = createAttemptStatusService({
      attemptStatusesDBService: { list },
    } as unknown as Parameters<typeof createAttemptStatusService>[0]);

    const result = await service.list("p1");

    expect(result as unknown).toBe(statuses);
    expect(list).toHaveBeenCalledWith("p1");
  });
});
