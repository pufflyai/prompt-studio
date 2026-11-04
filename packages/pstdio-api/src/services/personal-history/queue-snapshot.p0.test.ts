import { expect, test } from "bun:test";
import { pendingQueuedFollowUpsResponseSchema, sessionQueuedMessagesResponseSchema } from "pstdio-api-contracts";
import { sharedQueueResponse } from "./queue-snapshot";

test("incomplete offline queue previews remain read-only through the normal response contracts", () => {
  const shared = sharedQueueResponse("session", [
    { queuePosition: 1, revision: "revision", prompt: "Truncated…", model: "model" },
  ]);
  expect(sessionQueuedMessagesResponseSchema.parse(shared).queue?.readOnly).toBe(true);
  expect(pendingQueuedFollowUpsResponseSchema.parse(shared.queue).readOnly).toBe(true);
});
