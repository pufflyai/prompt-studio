import { expect, test } from "bun:test";
import { z } from "zod";
import type { CommandOutcome } from "../extension-kernel";
import { commandExecuteResponseSchema, commandExecutionResultSchema, commandOutcomeSchema } from "./execute";

test("legacy outcome schemas keep their object composition methods", () => {
  const outcome = { ok: true, status: "success", value: 1, requestId: "request" } satisfies CommandOutcome & {
    requestId: string;
  };
  const extended = commandOutcomeSchema.extend({ requestId: z.string() });
  const response = commandExecuteResponseSchema.pick({ outcome: true }).extend({ outcome: extended });
  expect(response.parse({ outcome })).toEqual({ outcome });
});

test("command response validation rejects contradictory outcomes and preserves complete rejection details", () => {
  for (const outcome of [
    { ok: true, status: "rejected", reason: "Conflict" },
    { ok: false, status: "success", value: {} },
    { ok: true, status: "error", reason: "Failed" },
  ])
    expect(commandExecutionResultSchema.safeParse({ commandId: "save", extensionId: "notes", outcome }).success).toBe(
      false,
    );
  const outcome = {
    ok: false,
    status: "rejected",
    code: "stale_revision",
    reason: "Changed",
    data: { expectedRevision: 1, actualRevision: 2 },
    cause: { code: "concurrent_save" },
    error: { message: "Changed", cause: { source: "storage" } },
    notices: [{ type: "warning", message: "Reload" }],
    diagnostics: [{ code: "conflict", message: "Revision changed", severity: "warning" }],
  } satisfies CommandOutcome;
  expect(commandExecutionResultSchema.parse({ commandId: "save", extensionId: "notes", outcome }).outcome).toEqual(
    outcome,
  );
});
