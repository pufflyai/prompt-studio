import { expect, test } from "bun:test";
import { runTestCommand } from "./run-test-command";

test("command failure reports its exit status and stderr before JSON parsing", async () => {
  await expect(
    runTestCommand("bun", ["-e", "console.error('browser startup failed'); process.exit(3)"], {}),
  ).rejects.toThrow(/code 3[\s\S]*browser startup failed/);
});

test("command success returns complete output after the child closes", async () => {
  const result = await runTestCommand("bun", ["-e", "console.log(JSON.stringify({ready: true}))"], {});
  expect(JSON.parse(result.stdout)).toEqual({ ready: true });
});
