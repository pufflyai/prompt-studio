import type { ResourceActivityEntry } from "pstdio-api-contracts";
import { resourceKey } from "pstdio-api-contracts/extension-kernel";
import { serializeFiles } from "../../services/shared-files/file-state";
import { createScopedSession } from "../extensions/command-environment/session-create";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { sendSessionFollowUp } from "../sessions/send-session-followup";
import { type resourceActivityAccess, runActivityOwnerCommand } from "./resource-activity-access";
import type { ActivityStore } from "./resource-activity-store";

type Access = NonNullable<Awaited<ReturnType<typeof resourceActivityAccess>>>;
const findSession = async (deps: ExtensionsRouteDeps, resource: Access["resource"], id: string) => {
  let cursor: string | undefined;
  do {
    const page = await deps.sessionService.query(resource.projectId, {
      anchor: resource,
      includeArchived: true,
      limit: 100,
      cursor,
    });
    const found = page.rows.find((session) =>
      session.anchors_json.some(
        (anchor) => resourceKey(anchor) === resourceKey(resource) && anchor.metadata?.activityEntryId === id,
      ),
    );
    if (found) return deps.sessionService.get(found.id);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return null;
};
const handoffPrompt = async (
  deps: ExtensionsRouteDeps,
  store: ActivityStore,
  access: Access,
  entry: ResourceActivityEntry,
) => {
  const target = entry.target!;
  const harness = await deps.harnessRegistry.get(target.harnessId, { projectId: access.resource.projectId });
  if (!harness) throw new Error("The selected harness is not enabled for this project.");
  if (!(await harness.listModels?.())?.some((model) => model.id === target.modelId))
    throw new Error("The selected model is not available for this harness.");
  if (!access.declaration?.activityContext) throw new Error("The resource owner does not provide handoff context.");
  const snapshot = (await runActivityOwnerCommand(deps, access.resource, access.declaration.activityContext, {
    resource: access.resource,
  })) as { text?: string };
  if (!snapshot?.text?.trim()) throw new Error("The resource snapshot is unavailable.");
  const discussion = (await store.query(access.resource, { limit: 100 })).items
    .filter((item) => item.kind === "comment")
    .reverse()
    .map((item) => `${item.author.name}: ${item.body}`)
    .join("\n\n");
  return `Resource: ${JSON.stringify(access.resource)}\n\n${snapshot.text}\n\nRelevant discussion:\n${discussion}\n\nRequested work:\n${entry.body}`;
};
const launch = async (
  deps: ExtensionsRouteDeps,
  store: ActivityStore,
  access: Access,
  entry: ResourceActivityEntry,
  options?: { workspaceId?: string },
) => {
  const existing = await findSession(deps, access.resource, entry.id);
  if (existing && existing.status !== "failed" && existing.status !== "cancelled") return existing.id;
  const prompt = await handoffPrompt(deps, store, access, entry);
  const target = entry.target!;
  if (existing) {
    const linkedWorkspace = await deps.workspaceSessionService.getWorkspaceBySessionId(existing.id);
    const workspace =
      linkedWorkspace ??
      (options?.workspaceId
        ? await deps.workspaceService.get(options.workspaceId)
        : await deps.workspaceService.getDefault(access.resource.projectId));
    if (!workspace || workspace.project_id !== access.resource.projectId)
      throw new Error("Choose an available workspace before retrying.");
    if (!linkedWorkspace) await deps.workspaceSessionService.link(workspace.id, existing.id);
    await sendSessionFollowUp(deps, existing, { prompt, agent: target.harnessId, model: target.modelId });
    return existing.id;
  }
  return (
    await createScopedSession(
      deps,
      { projectId: access.resource.projectId },
      {
        title: entry.body.slice(0, 100),
        prompt,
        workspaceId: options?.workspaceId,
        harness: { harnessId: target.harnessId, model: target.modelId },
        anchors: [
          { ...access.resource, role: "primary", metadata: { ...access.resource.metadata, activityEntryId: entry.id } },
        ],
      },
    )
  ).id;
};
export const handoffResourceActivity = (
  deps: ExtensionsRouteDeps,
  store: ActivityStore,
  access: Access,
  id: string,
  options?: { workspaceId?: string },
) =>
  serializeFiles(`activity-handoff:${resourceKey(access.resource)}:${id}`, async () => {
    const entry = await store.get(access.resource, id);
    if (entry.kind !== "comment" || entry.replyToId || !entry.target)
      throw new Error("Choose one harness and model on a root comment before confirming a handoff.");
    if (entry.handoffDeviceId !== (await deps.environmentService.get()).environmentId)
      throw new Error("This handoff belongs to another device. Retry on the device where it was created.");
    if (entry.sessionId) return entry;
    try {
      const sessionId = await launch(deps, store, access, entry, options);
      return await store.update(access.resource, id, (current) => ({ ...current, sessionId, handoffError: undefined }));
    } catch (error) {
      await store.update(access.resource, id, (current) => ({
        ...current,
        handoffError: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  });
