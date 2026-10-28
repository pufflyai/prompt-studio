import { expect, test } from "bun:test";
import { runTestCommand } from "./run-test-command";

test("command failure reports its exit status and stderr before JSON parsing", async () => {
  const failure = await runTestCommand(
    "bun",
    ["-e", "console.error('browser startup failed'); process.exit(3)"],
    {},
  ).catch((error: unknown) => error);
  expect(failure).toMatchObject({ message: expect.stringMatching(/code 3[\s\S]*browser startup failed/) });
});

test("command success returns complete output after the child closes", async () => {
  const result = await runTestCommand("bun", ["-e", "console.log(JSON.stringify({ready: true}))"], {});
  expect(JSON.parse(result.stdout)).toEqual({ ready: true });
});

test("command failure includes its structured stdout report", async () => {
  const failure = await runTestCommand(
    "bun",
    ["-e", "console.log(JSON.stringify({checks: [{message: 'Dashboard readiness failed'}]})); process.exit(1)"],
    {},
  ).catch((error: unknown) => error);
  expect(failure).toMatchObject({ message: expect.stringMatching(/code 1[\s\S]*Dashboard readiness failed/) });
});
