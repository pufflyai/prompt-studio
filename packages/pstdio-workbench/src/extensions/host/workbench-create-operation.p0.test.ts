import { expect, test } from "bun:test";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";

const command = { id: "planner.create-ticket", extensionId: "planner", title: "Create ticket" };

test("an uncorrelated create keeps the submitted content and no read can guess its result", async () => {
  const queries = createScopedQueryClient({ runtimeId: "desktop", extensionId: "pstdio" });
  const operations = getWorkbenchOperations(queries);
  const workbench = createWorkbench({ queries });
  const transport = Promise.withResolvers<unknown>();
  let writes = 0;
  const result = executeWorkbenchExtensionCommand(
    {
      projectId: "project",
      workbench,
      operations,
      metadata: { commands: [command] },
      createCommandIds: new Set([command.id]),
      executeCommand: () => {
        writes++;
        return transport.promise;
      },
    },
    command.id,
    { params: { content: "Same title" } },
  );
  const failed = result.catch((error: unknown) => error);
  expect(operations.getSnapshot().pending[0]).toMatchObject({
    status: "queued",
    title: "Create ticket",
    projectId: "project",
  });
  transport.reject(new PstdioConnectionError(new Error("Response lost")));
  const error = await failed;
  expect(error).toMatchObject({ name: "UnresolvedSubmissionError" });
  const entry = operations.getSnapshot().recovery[0];
  expect(entry).toMatchObject({ status: "unknown", canCheck: false, draft: { content: "Same title" } });
  operations.dismiss(entry.id);
  expect(operations.getSnapshot().recovery[0]?.draft).toEqual({ content: "Same title" });
  expect(writes).toBe(1);
  operations.discard(entry.id);
  expect(operations.getSnapshot().recovery).toHaveLength(0);
  await workbench.dispose();
  queries.dispose();
});
