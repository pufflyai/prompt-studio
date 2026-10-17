import type { Inputs, ProposalApi } from "./contracts";

export async function completeNotification(ctx: ProposalApi, input: Inputs) {
  const result = await ctx.notify.transition({ selector: { by: "id", id: input.notificationId }, status: "done" });
  return result.notifications[0] ?? null;
}

export async function completeNotificationsByKey(ctx: ProposalApi, input: Inputs) {
  const result = await ctx.notify.transition({
    selector: { by: "dedupeKey", dedupeKey: input.dedupeKey },
    status: "done",
  });
  return result.notifications;
}

export async function readTemplate(ctx: ProposalApi) {
  const files = await ctx.files.open({ root: "package" });
  return files.readText("templates/report.md");
}

export async function writeLocalDraft(ctx: ProposalApi) {
  const files = await ctx.files.open({ root: "local" });
  await files.writeText("draft.md", "Draft");
}

export async function writeSharedFile(ctx: ProposalApi) {
  const files = await ctx.files.open({ root: "shared", mount: "outputs" });
  await files.writeText("report.html", "<h1>Report</h1>");
}

export async function editCurrentWorkspace(ctx: ProposalApi) {
  const files = await ctx.files.open({ root: "workspace", target: "current" });
  await files.writeText("README.md", "Project README");
}

export async function saveTicket(ctx: ProposalApi, input: Inputs) {
  return ctx.storage.records.commit({
    operationId: input.saveId,
    edits: [
      { recordId: input.ticket.recordId, expectedRevision: input.ticket.revision, replace: { title: input.title } },
    ],
  });
}

export async function attachFile(ctx: ProposalApi, input: Inputs) {
  const asset = await ctx.storage.assets.stage({ operationId: `${input.uploadId}:bytes`, source: input.file });
  const recordId = ctx.storage.records.id(`attachment:${input.uploadId}`);
  const base = await ctx.storage.records.read(recordId);
  const outcome = await ctx.storage.records.commit({
    operationId: input.uploadId,
    edits: [
      {
        recordId,
        expectedRevision: base.revision,
        replace: { parentRecordId: input.ticket.recordId, name: input.file.name },
        asset,
      },
    ],
  });
  if (outcome.status === "conflict") throw new Error("Attachment conflict");
  return recordId;
}

export async function listWorkspaceSessions(ctx: ProposalApi, input: Inputs) {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.sessions.query({ workspaceId: input.workspaceId, cursor, limit: 50 });
    ids.push(...page.items.map((session) => session.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return ids;
}

export async function linkSession(ctx: ProposalApi, input: Inputs) {
  await ctx.resources.addAnchors({ type: "session", id: input.sessionId, extensionId: "pstdio" }, [
    { type: "ticket", id: input.ticketId, extensionId: "planner" },
  ]);
}

export async function readRejection(ctx: ProposalApi) {
  const outcome = await ctx.browser.execute();
  if (outcome.status !== "rejected") throw new Error("Expected rejection");
  return { code: outcome.code, data: outcome.data };
}

export async function consumeStream(ctx: ProposalApi) {
  const stream = ctx.commands.stream();
  const chunks: string[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { chunks, status: (await stream.outcome).status };
}

export async function resetSetting(ctx: ProposalApi) {
  await ctx.browser.settings.delete("editor.compact");
}

export async function deleteWorkspace(ctx: ProposalApi, input: Inputs) {
  await ctx.workspaces.delete(input.workspaceId);
}

export async function saveView(ctx: ProposalApi) {
  return ctx.views.update({ kind: "view", id: "tickets" }, "view-1", {
    filter: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Launch" }] },
    sorts: [{ attributeId: "title", direction: "asc" }],
  });
}

export const authorTasks = {
  completeNotification,
  completeNotificationsByKey,
  readTemplate,
  writeLocalDraft,
  writeSharedFile,
  editCurrentWorkspace,
  saveTicket,
  attachFile,
  listWorkspaceSessions,
  linkSession,
  readRejection,
  consumeStream,
  resetSetting,
  deleteWorkspace,
  saveView,
};
