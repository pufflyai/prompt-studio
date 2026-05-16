import { describe, expect, it } from "bun:test";
import { resolveProjectCreationAvailability } from "./availability";

describe("resolveProjectCreationAvailability", () => {
  it("shows the no-agent banner only when loading succeeds with zero installed agents", () => {
    expect(
      resolveProjectCreationAvailability({
        agentInfo: [],
        isAgentsLoading: false,
        isAgentsError: false,
      }),
    ).toMatchObject({
      isCreateProjectBlocked: true,
      showNoAgentsBanner: true,
      showAgentErrorBanner: false,
    });

    expect(
      resolveProjectCreationAvailability({
        agentInfo: [],
        isAgentsLoading: false,
        isAgentsError: true,
      }),
    ).toMatchObject({
      isCreateProjectBlocked: true,
      showNoAgentsBanner: false,
      showAgentErrorBanner: true,
    });
  });

  it("keeps creation enabled when an installed agent is available", () => {
    const result = resolveProjectCreationAvailability({
      agentInfo: [{ id: "opencode", name: "OpenCode", availability: { type: "INSTALLED" } }],
      isAgentsLoading: false,
      isAgentsError: false,
    });

    expect(result.isCreateProjectBlocked).toBe(false);
    expect(result.showNoAgentsBanner).toBe(false);
    expect(result.showAgentErrorBanner).toBe(false);
    expect(result.availableAgents.map((agent) => agent.id)).toEqual(["opencode"]);
  });
});
