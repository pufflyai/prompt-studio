import type { ParamDefinition, ResourceRef, RuntimeCommandRecord } from "@pstdio/sdk/extensions";
import type { createExtensionCommandService } from "./extension-command-service";
import type { createExtensionInstanceService } from "./extension-instance-service";
import { loadProjectExtensionRuntime } from "./extension-registry-runtime";
import type { createRepoService } from "./repo-service";
import type { createSessionService } from "./session-service";
import type { createWorkspaceService } from "./workspace-service";

type ExtensionActionDeps = {
  extensionCommandService: ReturnType<typeof createExtensionCommandService>;
  extensionInstanceService: Pick<ReturnType<typeof createExtensionInstanceService>, "list">;
  filesRoot: string;
  repoService: ReturnType<typeof createRepoService>;
  sessionService: Pick<ReturnType<typeof createSessionService>, "get">;
  workspaceService: Pick<ReturnType<typeof createWorkspaceService>, "get" | "getByShorthand">;
};

type ActionParamDescriptor = {
  key: string;
  label: string;
  type: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  templateType?: string;
};

export type ExtensionActionDescriptor = {
  key: string;
  label: string;
  targetType: string;
  placement: string;
  params?: ActionParamDescriptor[];
};

export class ExtensionActionNotFoundError extends Error {}

const actionPlacements = new Set(["primary", "secondary", "overflow"]);

const resolvePlacement = (slot: string) => {
  const placement = slot.split(".").at(-1) ?? "";
  return actionPlacements.has(placement) ? placement : "overflow";
};

const toDefaultValue = (value: unknown) =>
  typeof value === "string" || typeof value === "boolean" || typeof value === "number" ? String(value) : undefined;

const getDefaultValue = (param: ParamDefinition) =>
  "defaultValue" in param ? toDefaultValue(param.defaultValue) : undefined;

const toActionParamType = (param: ParamDefinition) => {
  if (param.type === "template") return "template-select";
  if (param.type === "harness") return "agent";
  if (param.type === "boolean") return "select";
  if (param.type === "resource") return "text";
  return param.type;
};

const toActionParam = ([key, param]: [string, ParamDefinition]): ActionParamDescriptor => ({
  key,
  label: param.label ?? key,
  type: toActionParamType(param),
  ...(param.description ? { description: param.description } : {}),
  ...(param.required === false ? { required: false } : {}),
  ...(getDefaultValue(param) ? { defaultValue: getDefaultValue(param) } : {}),
  ...(param.type === "select" ? { options: param.options } : {}),
  ...(param.type === "boolean"
    ? {
        options: [
          { value: "true", label: "True" },
          { value: "false", label: "False" },
        ],
      }
    : {}),
  ...(param.type === "template" && param.templateType ? { templateType: param.templateType } : {}),
});

const toActionParams = (command: RuntimeCommandRecord) => {
  const entries = Object.entries(command.params ?? {});
  if (entries.length === 0) return undefined;
  return entries.map(toActionParam);
};

const toActionDescriptors = (command: RuntimeCommandRecord) =>
  command.menus.map((menu) => ({
    key: command.id,
    label: menu.label ?? command.title,
    targetType: command.target ?? "project",
    placement: resolvePlacement(menu.slot),
    params: toActionParams(command),
    order: menu.order ?? 0,
  }));

const loadRuntime = (deps: ExtensionActionDeps, projectId: string) =>
  loadProjectExtensionRuntime(
    {
      extensionInstancesDBService: deps.extensionInstanceService,
      filesRoot: deps.filesRoot,
      repoService: deps.repoService,
    },
    projectId,
  );

const toPublicAction = (action: ReturnType<typeof toActionDescriptors>[number]): ExtensionActionDescriptor => ({
  key: action.key,
  label: action.label,
  targetType: action.targetType,
  placement: action.placement,
  ...(action.params ? { params: action.params } : {}),
});

const resolveWorkspaceTarget = async (deps: ExtensionActionDeps, projectId: string, targetId: string) => {
  const workspace =
    (await deps.workspaceService.get(targetId)) ?? (await deps.workspaceService.getByShorthand(projectId, targetId));
  if (!workspace) return null;

  return {
    type: "workspace",
    id: workspace.id,
    projectId,
    label: workspace.workspace_shorthand,
    metadata: {
      workspaceShorthand: workspace.workspace_shorthand,
      worktreePath: workspace.worktree_path,
      branch: workspace.branch,
      anchors: workspace.anchors_json,
    },
  } satisfies ResourceRef;
};

const resolveSessionTarget = async (deps: ExtensionActionDeps, projectId: string, targetId: string) => {
  const session = await deps.sessionService.get(targetId);
  if (!session) return null;

  return {
    type: "session",
    id: session.id,
    projectId,
    label: session.title,
    metadata: {
      status: session.status,
      agent: session.agent,
    },
  } satisfies ResourceRef;
};

const resolveTarget = async (
  deps: ExtensionActionDeps,
  projectId: string,
  targetType: string,
  targetId: string,
): Promise<ResourceRef> => {
  if (targetType === "workspace") {
    return (await resolveWorkspaceTarget(deps, projectId, targetId)) ?? { type: targetType, id: targetId, projectId };
  }

  if (targetType === "session") {
    return (await resolveSessionTarget(deps, projectId, targetId)) ?? { type: targetType, id: targetId, projectId };
  }

  return { type: targetType, id: targetId, projectId };
};

export const createExtensionActionService = (deps: ExtensionActionDeps) => {
  const list = async (projectId: string, filters: { targetType?: string } = {}) => {
    const runtime = await loadRuntime(deps, projectId);
    return runtime.commands
      .flatMap(toActionDescriptors)
      .filter((action) => !filters.targetType || action.targetType === filters.targetType)
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      .map(toPublicAction);
  };

  const execute = async (input: {
    projectId: string;
    actionKey: string;
    targetType: string;
    targetId: string;
    params?: Record<string, unknown>;
  }) => {
    const actions = await list(input.projectId);
    if (!actions.some((action) => action.key === input.actionKey)) {
      throw new ExtensionActionNotFoundError(`Extension action "${input.actionKey}" was not found.`);
    }

    return deps.extensionCommandService.execute({
      projectId: input.projectId,
      commandId: input.actionKey,
      params: input.params,
      target: await resolveTarget(deps, input.projectId, input.targetType, input.targetId),
    });
  };

  return { execute, list };
};
