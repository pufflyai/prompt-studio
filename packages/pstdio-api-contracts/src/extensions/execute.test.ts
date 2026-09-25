import { expect, test } from "bun:test";
import { type CommandExecuteResponse, commandExecuteResponseSchema } from "./execute";

test("command responses carry explicit navigation alongside data", () => {
  const response = {
    commandId: "create",
    extensionId: "notes",
    outcome: {
      ok: true,
      status: "success",
      value: { id: "one" },
      navigationRequests: [{ kind: "page", page: { kind: "page", id: "notes", extensionId: "notes" } }],
    },
  } satisfies CommandExecuteResponse;
  expect(commandExecuteResponseSchema.parse(response)).toEqual(response);
});
