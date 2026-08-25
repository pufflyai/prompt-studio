import { putAttempt } from "../data/attempt-storage";
import { putTicket, tagsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultTags } from "../data/seed";

const timestamp = "2026-08-18T09:00:00.000Z";

export const setupInputRequestTest = async () => {
  const storage = createMemoryStorage();
  await seedDefaultTags(storage);
  const flags = await tagsCollection(storage).get("default-awaiting-input");
  await tagsCollection(storage).put("default-awaiting-input", {
    ...flags!,
    name: "Interruptions",
    options: flags!.options.map((option) =>
      option.id === "default-awaiting-input-true" ? { ...option, name: "Needs a person" } : option,
    ),
  });
  await putTicket(storage, {
    id: "ticket-1",
    shorthand: "PS-1",
    title: "Input handoff",
    content: "# Input handoff",
    statusId: "in-review",
    tagIds: [],
    attachments: [],
    parentId: null,
    dependsOn: [],
    blockedReason: null,
    userPrompt: null,
    parallelizable: "yes",
    draft: false,
    archived: false,
    sortOrder: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await putAttempt(storage, {
    schemaVersion: 1,
    workspaceId: "workspace-1",
    workspaceShorthand: "PS-1_A1",
    ticketId: "ticket-1",
    ticketShorthand: "PS-1",
    implementationSessionId: "implementation-1",
    state: "approved",
    base: { workspaceId: null, headSha: "base-sha" },
    revisions: [
      {
        revision: 1,
        baseSha: "base-sha",
        headSha: "head-sha",
        changeRequestReportId: "change-report-1",
        submittedAt: timestamp,
        submittedBy: { type: "agent", id: "agent-1", displayName: "Agent" },
        reviews: [],
      },
    ],
    implementationDisconnectRetries: 0,
    reviewDisconnectRetries: 0,
    blocker: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return storage;
};
