import type { CurrentApi, Inputs } from "./contracts";

export async function completeNotification(ctx: CurrentApi, input: Inputs) {
  const notifications = await ctx.notify.resolve({ id: input.notificationId, status: "done" });
  return notifications[0] ?? null;
}

export async function completeNotificationsByKey(ctx: CurrentApi, input: Inputs) {
  return ctx.notify.resolve({ dedupeKey: input.dedupeKey, status: "done" });
}

export async function readTemplate(ctx: CurrentApi) {
  return ctx.packageFiles.readText("templates/report.md");
}

export async function writeLocalDraft(ctx: CurrentApi) {
  if (!ctx.extensionFiles) throw new Error("Extension files unavailable");
  await ctx.extensionFiles.writeText("draft.md", "Draft");
}

export async function writeSharedFile(ctx: CurrentApi) {
  await ctx.artifacts.mount("outputs").writeText("report.html", "<h1>Report</h1>");
}

export async function editCurrentWorkspace(ctx: CurrentApi) {
  if (!ctx.workspaceFiles) throw new Error("Current workspace unavailable");
  await ctx.workspaceFiles.writeText("README.md", "Project README");
}

export async function saveTicket(ctx: CurrentApi, input: Inputs) {
  return ctx.storage.records.commit({
    operationId: input.saveId,
    edits: [
      { recordId: input.ticket.recordId, expectedRevision: input.ticket.revision, replace: { title: input.title } },
    ],
  });
}

export async function attachFile(ctx: CurrentApi, input: Inputs) {
  const attachment = await ctx.storage
    .collection("tickets")
    .attachments(input.ticketId)
    .put({
      name: input.file.name,
      data: await input.file.arrayBuffer(),
      mimeType: input.file.type,
    });
  return attachment.id;
}

export async function listWorkspaceSessions(ctx: CurrentApi, input: Inputs) {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.sessions.query({ workspaceId: input.workspaceId, cursor, limit: 50 });
    ids.push(...page.items.map((session) => session.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return ids;
}

export async function linkSession(ctx: CurrentApi, input: Inputs) {
  await ctx.sessions.addAnchors(input.sessionId, [{ type: "ticket", id: input.ticketId, extensionId: "planner" }]);
}

export async function readRejection(ctx: CurrentApi) {
  const { outcome } = await ctx.browser.execute();
  if (outcome.status !== "rejected") throw new Error("Expected rejection");
  return { code: outcome.code, data: outcome.data };
}

export async function consumeStream(ctx: CurrentApi) {
  const chunks: string[] = [];
  let status: string | undefined;
  for await (const event of ctx.http.stream()) {
    if (event.type === "data") chunks.push(String(event.data));
    else status = event.response.outcome.status;
  }
  return { chunks, status };
}

export async function resetSetting(ctx: CurrentApi) {
  await ctx.browser.call("extension.settings.delete", { key: "editor.compact" });
}

export async function deleteWorkspace(ctx: CurrentApi, input: Inputs) {
  await ctx.workspaces.delete(input.workspaceId);
}

export async function saveView(ctx: CurrentApi) {
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
