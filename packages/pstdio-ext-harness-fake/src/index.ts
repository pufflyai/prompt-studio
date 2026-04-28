import { defineExtension, type HarnessProviderDefinition } from "@pstdio/sdk/extensions";
import { type AgentService, createFakeAgent } from "pstdio-agents";

export const FAKE_HARNESS_EXTENSION_ID = "pstdio.harness.fake";
export const FAKE_HARNESS_PACKAGE_NAME = "@pstdio/pstdio-ext-harness-fake";

const createProvider = (agent: AgentService): HarnessProviderDefinition => ({
  id: FAKE_HARNESS_EXTENSION_ID,
  label: agent.name,
  async detect() {
    return { available: true };
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
  getMessages(_ctx, sessionId, input) {
    return agent.getMessages(sessionId, input);
  },
});

const agent = createFakeAgent();

export default defineExtension({
  id: FAKE_HARNESS_EXTENSION_ID,
  name: "Fake Harness",
  version: "0.1.0",
  harnesses: {
    fake: createProvider(agent),
  },
});
