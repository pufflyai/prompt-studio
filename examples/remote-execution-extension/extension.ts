import type {
  HarnessContext,
  HarnessMessagesInput,
  HarnessReattachInput,
  HarnessResumeInput,
  HarnessStartInput,
  SessionMessage,
  WorkspaceProviderResult,
} from "@pstdio/sdk/extensions";
import {
  defineCommand,
  defineConnection,
  defineExtension,
  defineHarness,
  defineWorkspaceType,
  params,
  projectSlots,
} from "@pstdio/sdk/extensions";

const connectionId = "control-plane";
const extensionId = "example.remote-execution";
const providerId = `${extensionId}.workspace-type.remote`;
const harnessId = `${extensionId}.harness.remote-agent`;

const controlPlane = defineConnection({
  id: connectionId,
  label: "Remote control plane",
  transport: "http",
  auth: { type: "bearer" },
  supportsStreaming: true,
  allowedMethods: ["GET", "POST", "DELETE"],
  allowedPathPrefixes: ["/v1/workspaces", "/v1/sessions"],
  check: { method: "GET", path: "/v1/workspaces/health" },
});

const remoteCapabilities = {
  files: "none",
  diff: false,
  merge: false,
  rebase: false,
  archive: true,
  delete: true,
} as const;

const successfulBody = <T>(response: { status: number; body: T }) => {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Remote control plane request failed with HTTP ${response.status}.`);
  }
  return response.body;
};

const remoteWorkspace = defineWorkspaceType({
  id: "remote",
  label: "Remote workspace",
  params: { repository: params.text({ label: "Repository", required: true }) },
  async create(ctx, input) {
    const response = await ctx.connections.request<WorkspaceProviderResult>(connectionId, {
      method: "POST",
      path: "/v1/workspaces",
      body: { operationId: input.operationId, repository: input.params.repository },
      signal: input.signal,
    });
    return successfulBody(response);
  },
  async resolve(ctx, input) {
    const remoteId = String(input.providerRef.data.remoteId);
    const response = await ctx.connections.request<WorkspaceProviderResult>(connectionId, {
      method: "GET",
      path: `/v1/workspaces/${encodeURIComponent(remoteId)}`,
    });
    return successfulBody(response);
  },
  async cancel(ctx, input) {
    const remoteId = String(input.providerRef.data.remoteId);
    const response = await ctx.connections.request<WorkspaceProviderResult>(connectionId, {
      method: "POST",
      path: `/v1/workspaces/${encodeURIComponent(remoteId)}/cancel`,
      body: { operationId: input.operationId },
    });
    return successfulBody(response);
  },
  async archive(ctx, input) {
    const remoteId = String(input.providerRef.data.remoteId);
    const response = await ctx.connections.request<WorkspaceProviderResult>(connectionId, {
      method: "POST",
      path: `/v1/workspaces/${encodeURIComponent(remoteId)}/archive`,
      body: { operationId: input.operationId },
    });
    return successfulBody(response);
  },
  async delete(ctx, input) {
    const remoteId = String(input.providerRef.data.remoteId);
    const response = await ctx.connections.request(connectionId, {
      method: "DELETE",
      path: `/v1/workspaces/${encodeURIComponent(remoteId)}`,
      body: { operationId: input.operationId },
    });
    successfulBody(response);
  },
});

type RemoteSessionState = {
  id: string;
  status: "running" | "completed" | "failed" | "cancelled";
};

const pushPatchLines = (buffer: string, events: HarnessStartInput["events"]) => {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";
  for (const line of lines) {
    if (line.trim()) events.push(JSON.parse(line));
  }
  return remainder;
};

const streamSession = async (
  ctx: HarnessContext,
  sessionId: string,
  events: HarnessStartInput["events"],
  signal: AbortSignal,
) => {
  const decoder = new TextDecoder();
  try {
    while (!signal.aborted) {
      let buffer = "";
      for await (const event of ctx.connections.stream(connectionId, {
        method: "GET",
        path: `/v1/sessions/${encodeURIComponent(sessionId)}/events`,
        signal,
      })) {
        if (event.type === "response" && (event.status < 200 || event.status >= 300)) {
          throw new Error(`Remote session stream failed with HTTP ${event.status}.`);
        }
        if (event.type === "data") {
          buffer += decoder.decode(event.data, { stream: true });
          buffer = pushPatchLines(buffer, events);
        }
      }
      buffer += decoder.decode();
      pushPatchLines(`${buffer}\n`, events);
      const response = await ctx.connections.request<RemoteSessionState>(connectionId, {
        method: "GET",
        path: `/v1/sessions/${encodeURIComponent(sessionId)}`,
        signal,
      });
      const state = successfulBody(response);
      if (state.status !== "running") {
        return { status: state.status };
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { status: "cancelled" as const };
  } catch (error) {
    if (signal.aborted) return { status: "cancelled" as const };
    throw error;
  }
};

const remoteWorkspaceId = (input: HarnessStartInput | HarnessReattachInput) => {
  const target = input.workspace?.executionTarget;
  if (target?.kind !== "remote") throw new Error("The remote harness requires a remote workspace.");
  return String(target.providerRef.data.remoteId);
};

const attachRemoteHarnessSession = (ctx: HarnessContext, sessionId: string, events: HarnessStartInput["events"]) => {
  const controller = new AbortController();
  const id = sessionId;
  return {
    agentSessionId: id,
    done: streamSession(ctx, id, events, controller.signal),
    async stop() {
      try {
        const response = await ctx.connections.request(connectionId, {
          method: "DELETE",
          path: `/v1/sessions/${encodeURIComponent(id)}`,
        });
        successfulBody(response);
      } finally {
        controller.abort();
      }
    },
    timeoutStrategy: "provider" as const,
  };
};

const cleanUpAmbiguousSessionRequest = async (ctx: HarnessContext, sessionId: string, error: unknown) => {
  try {
    const response = await ctx.connections.request(connectionId, {
      method: "DELETE",
      path: `/v1/sessions/${encodeURIComponent(sessionId)}`,
    });
    successfulBody(response);
  } catch (cleanupError) {
    throw new AggregateError([error, cleanupError], "Remote session request and cleanup both failed.");
  }
  throw error;
};

const startRemoteHarnessSession = async (ctx: HarnessContext, input: HarnessStartInput) => {
  try {
    const response = await ctx.connections.request<{ id: string }>(connectionId, {
      method: "POST",
      path: `/v1/workspaces/${encodeURIComponent(remoteWorkspaceId(input))}/sessions`,
      body: { id: input.sessionId, prompt: input.prompt },
      signal: input.signal,
    });
    const state = successfulBody(response);
    if (state.id !== input.sessionId) {
      throw new Error("The control plane did not honor the stable host session ID.");
    }
    return attachRemoteHarnessSession(ctx, input.sessionId, input.events);
  } catch (error) {
    return cleanUpAmbiguousSessionRequest(ctx, input.sessionId, error);
  }
};

const resumeRemoteHarnessSession = async (ctx: HarnessContext, input: HarnessResumeInput) => {
  remoteWorkspaceId(input);
  try {
    const response = await ctx.connections.request(connectionId, {
      method: "POST",
      path: `/v1/sessions/${encodeURIComponent(input.agentSessionId)}/follow-ups`,
      body: {
        hostSessionId: input.sessionId,
        requestId: `${input.sessionId}:${input.messageOffset ?? 0}`,
        prompt: input.prompt,
      },
      signal: input.signal,
    });
    successfulBody(response);
  } catch (error) {
    return cleanUpAmbiguousSessionRequest(ctx, input.agentSessionId, error);
  }
  return attachRemoteHarnessSession(ctx, input.agentSessionId, input.events);
};

const reattachRemoteHarnessSession = (ctx: HarnessContext, input: HarnessReattachInput) => {
  remoteWorkspaceId(input);
  return attachRemoteHarnessSession(ctx, input.agentSessionId, input.events);
};

const remoteHarness = defineHarness({
  id: "remote-agent",
  label: "Remote agent",
  cwdRequirement: "optional",
  capabilities: () => ["SessionReattach"],
  start: startRemoteHarnessSession,
  resume: resumeRemoteHarnessSession,
  reattach: reattachRemoteHarnessSession,
  async getMessages(ctx, input: HarnessMessagesInput) {
    const response = await ctx.connections.request<{ messages: SessionMessage[] }>(connectionId, {
      method: "GET",
      path: `/v1/sessions/${encodeURIComponent(input.agentSessionId)}/messages`,
    });
    return successfulBody(response).messages;
  },
});

const launch = defineCommand({
  id: "launch",
  title: "Launch remote session",
  automation: true,
  palette: [{ group: "Remote execution", label: "Launch remote session" }],
  menus: [{ slot: projectSlots.headerOverflow, label: "Launch remote session", icon: "cloud" }],
  params: {
    repository: params.text({ label: "Repository", required: true }),
    prompt: params.longText({ label: "Prompt", required: true }),
  },
  async run(ctx, input) {
    const workspace = await ctx.workspaces.create({
      project_id: ctx.projectId,
      shorthand_base: "remote",
      provider_id: providerId,
      params: { repository: input.repository },
    });
    const session = await ctx.sessions.create({
      title: `Remote session: ${workspace.workspace_shorthand ?? workspace.id}`,
      prompt: input.prompt,
      workspaceId: workspace.id,
      harness: { harnessId },
    });
    return { workspaceId: workspace.id, sessionId: session.id };
  },
});

export default defineExtension({
  connections: [controlPlane],
  workspaceTypes: [remoteWorkspace],
  harnesses: [remoteHarness],
  commands: [launch],
});

export { remoteCapabilities };
