import { expect, test } from "bun:test";
import { recoveryError } from "./recovery-error";

test("a crashed runtime shows a concise recovery explanation while its output stays in logs", () => {
  const output =
    "Dashboard: http://127.0.0.1:1234\n" +
    Array.from({ length: 200 }, () =>
      JSON.stringify({ level: 30, event: "runtime.startup.phase", msg: "Runtime startup progress" }),
    ).join("\n");
  expect(recoveryError(new Error(output))).toMatchObject({
    code: "unexpected_exit",
    message: "The Prompt Studio runtime stopped unexpectedly.",
    actions: ["retry", "open_logs", "copy_diagnostics", "quit"],
  });
});

test("runtime output with a database failure keeps the actionable recovery category", () => {
  const output = JSON.stringify({ level: 50, event: "db.open.failed", message: "database detail" });
  expect(recoveryError(new Error(output))).toMatchObject({
    code: "pglite_recovery_failure",
    message: "Prompt Studio could not open its database safely.",
  });
});

test("a classified startup failure retains its specific explanation", () => {
  expect(recoveryError(new Error("unexpected_exit: Could not load the executable search path."))).toMatchObject({
    code: "unexpected_exit",
    message: "Could not load the executable search path.",
  });
});
