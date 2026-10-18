import type { PstdioClient } from "./client";

const resourceConventions = async (client: PstdioClient) => {
  const project = await client.projects.create({ initialWorkspace: { providerId: "pstdio.root", params: {} } });
  const updated = await client.projects.update(project.id, { defaultAgentId: null });
  const workspace = await client.workspaces.create(project.id, { providerId: "pstdio.worktree" });
  const session = await client.sessions.create(project.id, { title: "Work", workspaceId: workspace.id });
  const skill = await client.skills.get(project.id, "review");
  const page = await client.projects.query();
  const cursor: string | null = page.nextCursor;
  void [project.createdAt, updated.defaultAgentId, workspace.rootPath, session.projectId, skill.sourceKind, cursor];

  await client.workspaces.create({ project_id: project.id, provider_id: "pstdio.worktree" });
  await client.sessions.create({ project_id: project.id, title: "Legacy" });
  // @ts-expect-error Canonical scope-first calls use camelCase input.
  await client.sessions.create(project.id, { project_id: "other", title: "Invalid" });
};
void resourceConventions;

const preserveSessionResponse = (
  legacy: import("pstdio-api-contracts").Session & import("pstdio-api-contracts").ExtensionSession,
) => {
  const created: import("pstdio-api-contracts").CreateSessionResponse = legacy;
  return created;
};
void preserveSessionResponse;

const canonicalSessionResponses = (
  created: import("../resources").SessionCreateResponse,
  followUp: import("../resources").SessionFollowUpResponse,
) => {
  const projectId: string | null = created.projectId;
  if (followUp.followUp.status === "queued") {
    const position: number = followUp.followUp.queuePosition;
    void position;
  }
  void projectId;
};
void canonicalSessionResponses;
