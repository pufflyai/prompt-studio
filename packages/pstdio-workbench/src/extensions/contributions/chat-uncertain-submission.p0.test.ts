import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { runTrackedCreate } from "../host/workbench-create-operation";
import { createChatSession } from "./chat-session";

test("a lost new-session response keeps the prompt and prevents a second submission", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  let writes = 0;
  const session = createChatSession({
    query: async () => ({}),
    action: async () => {
      writes++;
      throw new PstdioConnectionError(new Error("Response lost"));
    },
    trackCreate: (action, execute) =>
      runTrackedCreate(operations, {
        projectId: "project",
        subjects: ["draft-session"],
        title: "Start session",
        draft: { text: action.text, attachments: action.attachments },
        write: execute,
      }),
  });
  const action = { type: "submit" as const, text: "Retain this prompt", attachments: [], values: {} };
  try {
    await expect(session.run(action)).rejects.toThrow("Creation could not be confirmed");
    const receipt = session.getSnapshot().pending?.[0];
    expect(receipt).toMatchObject({ text: action.text, failure: "Creation could not be confirmed." });
    expect(session.hasUnresolvedSubmission()).toBe(true);
    expect(session.getSnapshot().messages[0]?.delivery).toBeUndefined();
    expect(operations.getSnapshot().recovery[0]).toMatchObject({
      status: "unknown",
      canCheck: false,
      draft: { text: action.text },
    });
    session.dismissSubmission(receipt!.message.id);
    await expect(session.run(action)).rejects.toThrow("Creation could not be confirmed");
    expect(writes).toBe(1);
    expect(session.hasUnresolvedSubmission()).toBe(true);
    receipt!.unresolved!.recovery.discard();
    session.discardUnresolvedSubmission(receipt!.message.id);
    expect(session.hasUnresolvedSubmission()).toBe(false);
    expect(operations.getSnapshot().recovery).toHaveLength(0);
  } finally {
    await session.dispose();
    queries.dispose();
  }
});
