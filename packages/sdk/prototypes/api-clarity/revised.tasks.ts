import type { Inputs, RevisedApi } from "./contracts";

export async function completeNotification(ctx: RevisedApi, input: Inputs) {
  return ctx.notify.setStatus(input.notificationId, "done");
}

export async function completeNotificationsByKey(ctx: RevisedApi, input: Inputs) {
  return ctx.notify.setStatusByKey(input.dedupeKey, "done");
}

export async function readTemplate(ctx: RevisedApi) {
  return ctx.files.package.readText("templates/report.md");
}

export async function writeLocalDraft(ctx: RevisedApi) {
  await ctx.files.local.writeText("draft.md", "Draft");
}

export async function writeSharedFile(ctx: RevisedApi) {
  await ctx.files.shared("outputs").writeText("report.html", "<h1>Report</h1>");
}

export async function editCurrentWorkspace(ctx: RevisedApi) {
  await ctx.files.currentWorkspace.writeText("README.md", "Project README");
}

export async function saveTicket(ctx: RevisedApi, input: Inputs) {
  return ctx.storage.records.save(input.ticket, { title: input.title }, { operationId: input.saveId });
}

export async function attachFile(ctx: RevisedApi, input: Inputs) {
  const attachment = await ctx.storage.attachments.add(input.ticket.recordId, input.file, {
    operationId: input.uploadId,
  });
  return attachment.recordId;
}

export async function listWorkspaceSessions(ctx: RevisedApi, input: Inputs) {
  const ids: string[] = [];
  for await (const session of ctx.sessions.iterate({ workspaceId: input.workspaceId })) ids.push(session.id);
  return ids;
}

export async function linkSession(ctx: RevisedApi, input: Inputs) {
  await ctx.resources.addAnchors({ type: "session", id: input.sessionId }, [{ type: "ticket", id: input.ticketId }]);
}

export async function readRejection(ctx: RevisedApi) {
  const outcome = await ctx.browser.execute();
  if (outcome.status !== "rejected") throw new Error("Expected rejection");
  return { code: outcome.code, data: outcome.data };
}

export async function consumeStream(ctx: RevisedApi) {
  const stream = ctx.commands.stream();
  const chunks: string[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { chunks, status: (await stream.outcome).status };
}

export async function resetSetting(ctx: RevisedApi) {
  await ctx.browser.settings.delete("editor.compact");
}

export async function deleteWorkspace(ctx: RevisedApi, input: Inputs) {
  await ctx.workspaces.delete(input.workspaceId);
}

export async function saveView(ctx: RevisedApi) {
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
