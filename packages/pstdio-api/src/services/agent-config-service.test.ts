import { describe, expect, mock, test } from "bun:test";
import { createAgentConfigService } from "./agent-config-service";

describe("AgentConfigService", () => {
  test("list delegates to the DB service", async () => {
    const configs = [{ id: "ac1", name: "claude" }];
    const list = mock(async () => configs);
    const service = createAgentConfigService({
      agentConfigsDBService: { list },
    } as unknown as Parameters<typeof createAgentConfigService>[0]);

    const result = await service.list();

    expect(result as unknown).toBe(configs);
    expect(list).toHaveBeenCalled();
  });
});
