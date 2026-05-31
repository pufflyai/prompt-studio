import type { AgentId, AgentService, AvailabilityInfo } from "pstdio-agents";

export const createTestAgent = (id: AgentId, availability: AvailabilityInfo) =>
  ({
    id,
    name: id,
    capabilities: () => [],
    checkAvailability: () => availability,
    listModels: () => [],
    startSession: async () => ({}),
    resumeSession: async () => ({}),
    getMessages: async () => [],
    listSessions: async () => [],
    exportSession: async () => ({ session: { id: "session", title: "Session" }, messages: [] }),
    launchSession: async () => ({}),
  }) as unknown as AgentService;
