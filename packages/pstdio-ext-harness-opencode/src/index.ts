import { defineExtension, type HarnessProviderDefinition } from "@pstdio/sdk/extensions";
import { type AgentService, createOpencodeAgent } from "pstdio-agents";

export const OPENCODE_HARNESS_EXTENSION_ID = "pstdio.harness.opencode";
export const OPENCODE_HARNESS_PACKAGE_NAME = "@pstdio/pstdio-ext-harness-opencode";

const createProvider = (agent: AgentService): HarnessProviderDefinition => ({
  id: OPENCODE_HARNESS_EXTENSION_ID,
  label: agent.name,
  async detect() {
    const availability = agent.checkAvailability();
    return {
      available: availability.type === "INSTALLED",
      reason: availability.type === "INSTALLED" ? undefined : "OpenCode executable was not found.",
    };
  },
  listModels() {
    return agent.listModels();
  },
  async start(_ctx, input) {
    const result = await agent.startSession({
      prompt: input.prompt ?? "",
      cwd: input.workspacePath,
      env: { PSTDIO_SESSION_ID: input.sessionId },
    });

    return {
      runId: result.sessionId,
      onExit: result.process?.onExit,
    };
  },
  startSession(_ctx, input) {
    return agent.startSession(input);
  },
  resumeSession(_ctx, input, eventStore, approvalService) {
    return agent.resumeSession(input, eventStore, approvalService);
  },
  reattachSession(_ctx, input, eventStore) {
    return agent.reattachSession?.(input, eventStore) ?? Promise.resolve({});
  },
  getMessages(_ctx, sessionId, input) {
    return agent.getMessages(sessionId, input);
  },
});

const agent = createOpencodeAgent();

export default defineExtension({
  id: OPENCODE_HARNESS_EXTENSION_ID,
  name: "OpenCode Harness",
  version: "0.1.0",
  harnesses: {
    opencode: createProvider(agent),
  },
});
