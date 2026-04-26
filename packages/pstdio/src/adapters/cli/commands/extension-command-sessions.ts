import type { ExtensionSessionsApi, ResourceRef } from "@pstdio/sdk/extensions";

type CreateSessionInput = {
  project_id: string;
  title: string;
  prompt: string;
  workspace_id?: string;
};

type CreateExtensionCommandSessionsInput = {
  projectId: string;
  ensureApi: () => Promise<void>;
  createSession: (input: CreateSessionInput) => Promise<unknown>;
};

type SessionInput = Parameters<ExtensionSessionsApi["create"]>[0];

const supportedAnchorTypes = new Set(["project", "workspace"]);

const findWorkspaceAnchor = (anchors: ResourceRef[] | undefined) => {
  const workspaceAnchors = anchors?.filter((anchor) => anchor.type === "workspace") ?? [];
  return workspaceAnchors.find((anchor) => anchor.role === "primary") ?? workspaceAnchors[0];
};

const findUnsupportedAnchor = (anchors: ResourceRef[] | undefined) =>
  anchors?.find((anchor) => !supportedAnchorTypes.has(anchor.type));

const createApiSessionInput = (input: CreateExtensionCommandSessionsInput, sessionInput: SessionInput) => {
  const prompt = sessionInput.prompt;
  if (!prompt) {
    throw new Error("Extension command API sessions require a prompt.");
  }

  if (sessionInput.metadata !== undefined) {
    throw new Error("Extension command API sessions cannot preserve metadata yet.");
  }

  const unsupportedAnchor = findUnsupportedAnchor(sessionInput.anchors);
  if (unsupportedAnchor) {
    throw new Error(`Extension command API sessions cannot preserve "${unsupportedAnchor.type}" anchors yet.`);
  }

  const workspaceAnchor = findWorkspaceAnchor(sessionInput.anchors);
  return {
    project_id: input.projectId,
    title: sessionInput.title,
    prompt,
    workspace_id: workspaceAnchor?.id,
  };
};

export const createExtensionCommandSessions = (input: CreateExtensionCommandSessionsInput) => {
  const sessions = {
    create: async (sessionInput) => {
      const apiInput = createApiSessionInput(input, sessionInput);
      await input.ensureApi();
      return input.createSession(apiInput);
    },
  } satisfies ExtensionSessionsApi;

  return sessions;
};
