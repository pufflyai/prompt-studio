import type { DraftHarnessCommandInput } from "pstdio-api-contracts";
import { HarnessDisposedError } from "pstdio-api-runtime-host";
import { readCurrentHarness } from "../harnesses/read-current-harness";
import type { SessionsRouteDeps } from "./deps";
import { resolveCreateSessionModel } from "./endpoints/resolve-create-session";
import { resolveCreateWorkspace } from "./endpoints/resolve-create-workspace";
import { resolveHarnessRunParams } from "./harness-params";
import { HarnessOperationError } from "./session-harness-commands";
import { toHarnessWorkspaceContext } from "./session-workspace-context";

export const getDraftHarnessCommands = async (deps: SessionsRouteDeps, input: DraftHarnessCommandInput) => {
  const project = await deps.projectService.get(input.project_id);
  if (!project) throw new HarnessOperationError("Project not found.", 404);
  if (!(await deps.harnessRegistry.get(input.agent, { projectId: input.project_id })))
    throw new HarnessOperationError("The selected harness is not enabled for this project.", 404);
  const resolved = await resolveCreateWorkspace(deps, input.project_id, input.workspace_id);
  if (resolved.error) throw new HarnessOperationError(resolved.error, resolved.status);
  const record = resolved.workspace!;
  if (record.initializing || record.setup_error || record.provider_state !== "ready")
    throw new HarnessOperationError("The workspace is not ready.", 409);
  const workspace = toHarnessWorkspaceContext(record)!;
  const cwd = workspace.executionTarget.kind === "local" ? workspace.executionTarget.rootPath : undefined;
  const model = await resolveCreateSessionModel(input.model, project, input.agent, deps.harnessRegistry, {
    requestAgentWasOmitted: false,
  });
  const params = await resolveHarnessRunParams(deps, {
    projectId: input.project_id,
    agentId: input.agent,
    model,
    overrides: input.params,
  });
  try {
    const response = await readCurrentHarness(
      deps.harnessRegistry,
      input.agent,
      { projectId: input.project_id },
      async (harness) => {
        if (workspace.executionTarget.kind === "remote" && harness.cwdRequirement === "required")
          throw new HarnessOperationError("This harness requires a local workspace.", 400);
        return {
          ...(await harness.getCommandState({ workspace, cwd, model, params }, { projectId: input.project_id })),
          harnessId: harness.id,
        };
      },
    );
    if (!response) throw new HarnessOperationError("The selected harness is not enabled for this project.", 404);
    return response;
  } catch (error) {
    if (error instanceof HarnessDisposedError)
      throw new HarnessOperationError("The harness changed during discovery. Try again.", 409);
    throw error;
  }
};
