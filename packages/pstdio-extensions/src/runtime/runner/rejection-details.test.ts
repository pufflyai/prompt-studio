import { expect, test } from "bun:test";
import type { CommandFailureDetails } from "pstdio-api-contracts/extension-kernel";
import { makeRunner } from "./runner.test-fixture";

for (const host of [false, true]) {
  test(`${host ? "host" : "extension"} command rejections retain complete details and collected notices`, async () => {
    const details = {
      code: "stale_revision",
      reason: "Changed",
      data: { expectedRevision: 1, actualRevision: 2 },
      cause: { code: "concurrent_save" },
      error: { message: "Changed", cause: { source: "storage" } },
      notices: [{ type: "warning", message: "Reload" }],
      diagnostics: [{ code: "conflict", message: "Revision changed", severity: "warning" }],
    } satisfies CommandFailureDetails;
    const collected = { type: "info" as const, message: "Review the latest revision" };
    const command = { extensionId: host ? "pstdio" : "pstdio.lab", kind: "command" as const, id: "save" };
    const runner = makeRunner({
      commands: [{ id: "save", ref: { kind: "command", id: "save" }, title: "Save", run: async () => ({}) }],
      middlewares: [
        {
          id: "guard",
          ref: { kind: "middleware", id: "guard" },
          command,
          async run(ctx) {
            await ctx.notify.toast(collected);
            return ctx.commands.reject(details);
          },
        },
      ],
    });
    const outcome = host
      ? await runner.executeHostCommand({ commandId: "save", projectId: "p1", run: async () => ({}) })
      : await runner.execute({ commandId: "pstdio.lab.command.save", projectId: "p1" });
    expect(outcome).toEqual({ ...details, ok: false, status: "rejected", notices: [...details.notices, collected] });
  });
}
