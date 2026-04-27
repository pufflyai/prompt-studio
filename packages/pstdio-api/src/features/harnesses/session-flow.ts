import type { AgentId } from "pstdio-agents";
import type { CreateHarnessSessionInput, SendHarnessSessionInput } from "pstdio-api-contracts";
import type { RouteDeps } from "../deps";
import { isAgentEnabledForProject, parseProjectSelectedAgents } from "../projects/selected-agents";
import { composeSummary } from "../sessions/compose-summary";
import { getSessionMessages } from "../sessions/get-session-messages";
import { resolvePrompt } from "../sessions/resolve-prompt";
import { resolveSessionCwd } from "../sessions/resolve-session-cwd";
import { resumeAgentSession, spawnAgentSession } from "../sessions/spawn-agent";
import { toAgentId, toHarnessId } from "./harness-ids";

type ProjectRecord = Awaited<ReturnType<RouteDeps["projectService"]["get"]>>;

type HarnessResolution =
  | { type: "ok"; harnessId: string; agentId: string }
  | { type: "error"; status: 400 | 404; error: string };

const isHarnessEnabledForProject = (project: ProjectRecord, agentId: string, harnessId: string) => {
  if (!project) return true;
  const selectedAgents = parseProjectSelectedAgents(project);
  if (selectedAgents.length === 0) return true;
  return isAgentEnabledForProject(project, agentId) || selectedAgents.includes(harnessId);
};

const resolveRequestedHarness = (harness: string, deps: RouteDeps, project: ProjectRecord): HarnessResolution => {
  const agentId = toAgentId(harness);
  const harnessId = toHarnessId(agentId);

  if (!isHarnessEnabledForProject(project, agentId, harnessId)) {
    return { type: "error", status: 400, error: `Harness '${harnessId}' is not enabled for this project.` };
  }

  if (!deps.agentRegistry.get(agentId as AgentId)) {
    return { type: "error", status: 404, error: `Harness not found: ${harnessId}` };
  }

  return { type: "ok", harnessId, agentId };
};

const resolveDefaultHarness = async (deps: RouteDeps, project: ProjectRecord): Promise<HarnessResolution> => {
  const configuredAgents = await deps.agentConfigService.list();
  const selectedAgents = project ? parseProjectSelectedAgents(project) : [];
  const availableConfiguredAgents =
    selectedAgents.length === 0
      ? configuredAgents
      : configuredAgents.filter((config) => {
          const harnessId = toHarnessId(config.agent_id);
          return selectedAgents.includes(config.agent_id) || selectedAgents.includes(harnessId);
        });
  const defaultAgent = availableConfiguredAgents.find((config) => config.is_default) ?? availableConfiguredAgents[0];

  if (!defaultAgent) {
    return {
      type: "error",
      status: 400,
      error: "No harness configured. Set a default harness with 'pstdio harnesses setup' first.",
    };
  }

  return resolveRequestedHarness(defaultAgent.agent_id, deps, project);
};

const resolveHarness = async (harness: string | undefined, deps: RouteDeps, project: ProjectRecord) => {
  if (harness) return resolveRequestedHarness(harness, deps, project);
  return resolveDefaultHarness(deps, project);
};

const resolveWorkspaceId = async (input: CreateHarnessSessionInput, deps: RouteDeps) => {
  if (!input.workspace_id) return undefined;

  const workspace =
    (await deps.workspaceService.get(input.workspace_id)) ??
    (await deps.workspaceService.getByShorthand(input.project_id, input.workspace_id));
  if (!workspace) {
    return { error: `Workspace not found: ${input.workspace_id}` };
  }

  return { workspaceId: workspace.id };
};

export const startHarnessSession = async (input: CreateHarnessSessionInput, deps: RouteDeps) => {
  const project = await deps.projectService.get(input.project_id);
  if (!project) {
    return { type: "error" as const, status: 404 as const, error: `Project not found: ${input.project_id}` };
  }

  const workspaceResult = await resolveWorkspaceId(input, deps);
  if (workspaceResult?.error) {
    return { type: "error" as const, status: 404 as const, error: workspaceResult.error };
  }

  const harness = await resolveHarness(input.harness, deps, project);
  if (harness.type === "error") return harness;

  const cwd = await resolveSessionCwd(deps, input.project_id, workspaceResult?.workspaceId);
  const prompt = await resolvePrompt(input, input.project_id, deps);
  const session = await deps.sessionService.create({
    project_id: input.project_id,
    title: input.title,
    agent: harness.harnessId,
    original_session_id: input.original_session_id,
    cwd: cwd ?? undefined,
  });

  if (workspaceResult?.workspaceId) {
    const link = await deps.workspaceSessionService.link(workspaceResult.workspaceId, session.id);
    deps.eventBus.emit("workspace_sessions", "set", link);
  }

  spawnAgentSession(
    {
      sessionId: session.id,
      agentId: harness.agentId,
      prompt,
      title: input.title,
      model: input.model,
      cwd,
    },
    deps,
  ).catch(async () => {
    await deps.sessionService.transitionStatus(session.id, "failed");
  });

  return { type: "ok" as const, session };
};

const buildSendPrompt = async (input: SendHarnessSessionInput, projectId: string, deps: RouteDeps) => {
  let prompt = await resolvePrompt(input, projectId, deps);

  if (input.summary_from_session_id) {
    const messages = await getSessionMessages(input.summary_from_session_id, deps);
    const summary = composeSummary(messages, {
      format: input.summary_format ?? "brief",
      role: input.summary_role ?? "assistant",
    });

    if (summary) {
      const block = `<session-summary>\n${summary}\n</session-summary>`;
      prompt = prompt ? `${prompt}\n\n${block}` : block;
    }
  }

  return prompt;
};

export const sendHarnessSession = async (sessionId: string, input: SendHarnessSessionInput, deps: RouteDeps) => {
  const session = await deps.sessionService.get(sessionId);
  if (!session) {
    return { type: "error" as const, status: 404 as const, error: `Session not found: ${sessionId}` };
  }

  if (session.status === "in_progress") {
    return {
      type: "error" as const,
      status: 409 as const,
      error: "Session is in_progress — wait for it to finish or fail before sending a follow-up.",
    };
  }

  const project = await deps.projectService.get(session.project_id!);
  const currentHarnessId = session.agent ? toHarnessId(toAgentId(session.agent)) : undefined;
  const harness = await resolveHarness(input.harness ?? currentHarnessId, deps, project);
  if (harness.type === "error") return harness;

  const prompt = await buildSendPrompt(input, session.project_id!, deps);
  await deps.sessionService.resume(session.id);

  const cwd = session.cwd ?? undefined;
  const switchingHarness = currentHarnessId !== harness.harnessId;
  if (switchingHarness) {
    await deps.sessionService.update(session.id, { agent: harness.harnessId, agent_session_id: null });
    spawnAgentSession({ sessionId: session.id, agentId: harness.agentId, prompt, model: input.model, cwd }, deps);
  } else if (session.agent_session_id) {
    resumeAgentSession(
      {
        sessionId: session.id,
        agentSessionId: session.agent_session_id,
        agentId: harness.agentId,
        prompt,
        model: input.model,
        cwd,
        questionResponse: input.question_response,
      },
      deps,
    );
  } else {
    spawnAgentSession({ sessionId: session.id, agentId: harness.agentId, prompt, model: input.model, cwd }, deps);
  }

  const result = await deps.sessionService.get(session.id);
  return { type: "ok" as const, session: result };
};
