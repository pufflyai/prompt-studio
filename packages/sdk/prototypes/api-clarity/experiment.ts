import { type Design, type Task, tasks } from "./contracts";
import { authorTasks as current } from "./current.tasks";
import { createFixture } from "./fixture";
import { authorTasks as proposal } from "./proposal.tasks";
import { authorTasks as revised } from "./revised.tasks";

export const runTask = async (design: Design, task: Task) => {
  const fixture = await createFixture();
  let result: unknown;
  const implementations = { current: { ...current }, proposal: { ...proposal }, revised: { ...revised } };
  if (design === "current") result = await implementations.current[task](fixture.apis.current, fixture.inputs);
  else if (design === "proposal") result = await implementations.proposal[task](fixture.apis.proposal, fixture.inputs);
  else result = await implementations.revised[task](fixture.apis.revised, fixture.inputs);
  return { fixture, result };
};

export const verifyTask = async (design: Design, task: Task) => {
  const { fixture, result } = await runTask(design, task);
  const { inputs, apis } = fixture;
  const checks: Record<Task, () => boolean | Promise<boolean>> = {
    completeNotification: () => fixture.notifications.get(inputs.notificationId)?.status === "done",
    completeNotificationsByKey: () =>
      fixture.notifications.get("review-1")?.status === "done" &&
      fixture.notifications.get("review-2")?.status === "done",
    readTemplate: () => result === "# Report template",
    writeLocalDraft: async () => (await fixture.roots.local.readText("draft.md")) === "Draft",
    writeSharedFile: async () => (await fixture.roots.shared.readText("report.html")) === "<h1>Report</h1>",
    editCurrentWorkspace: async () => (await fixture.roots.current.readText("README.md")) === "Project README",
    saveTicket: async () =>
      JSON.stringify((await fixture.storage.records.read(inputs.ticket.recordId)).value) ===
      JSON.stringify({ title: inputs.title }),
    attachFile: async () => {
      if (typeof result !== "string") return false;
      if (design === "current") {
        const bytes = await apis.current.storage.collection("tickets").attachments(inputs.ticketId).getBytes(result);
        return new TextDecoder().decode(bytes) === "report bytes";
      }
      const record = await fixture.storage.records.read(result);
      if (!record.asset) return false;
      const bytes = await fixture.storage.assets.read(record.asset);
      return (
        (await new Response(bytes).text()) === "report bytes" &&
        JSON.stringify(record.value) ===
          JSON.stringify({ parentRecordId: inputs.ticket.recordId, name: inputs.file.name })
      );
    },
    listWorkspaceSessions: () => Array.isArray(result) && result.length === 63 && result.includes("session-62"),
    linkSession: () =>
      JSON.stringify(fixture.links) ===
      JSON.stringify([
        {
          source: { type: "session", id: inputs.sessionId, extensionId: "pstdio" },
          targets: [{ type: "ticket", id: inputs.ticketId, extensionId: "planner" }],
        },
      ]),
    readRejection: () =>
      JSON.stringify(result) === JSON.stringify({ code: "stale_revision", data: { recordId: "ticket-1" } }),
    consumeStream: () => JSON.stringify(result) === JSON.stringify({ chunks: ["first", "second"], status: "success" }),
    resetSetting: () => !fixture.settings.has("editor.compact"),
    deleteWorkspace: () => fixture.deletedWorkspaces.has(inputs.workspaceId),
    saveView: () =>
      result !== null &&
      typeof result === "object" &&
      "sorts" in result &&
      "filter" in result &&
      JSON.stringify(result.sorts) === JSON.stringify([{ attributeId: "title", direction: "asc" }]) &&
      JSON.stringify(result.filter) ===
        JSON.stringify({
          conjunction: "and",
          rules: [{ attributeId: "title", condition: "contains", value: "Launch" }],
        }),
  };
  // Verification reads are excluded from the recorded task calls.
  const operations = [...fixture.calls];
  if (!(await checks[task]())) throw new Error(`${design}.${task} did not produce the required result`);
  return { task, operations };
};

export const verifyDesign = async (design: Design) => {
  const results = [];
  for (const task of tasks) results.push(await verifyTask(design, task));
  return results;
};
