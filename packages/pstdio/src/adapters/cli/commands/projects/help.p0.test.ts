import { expect, test } from "bun:test";
import yargs from "yargs";
import * as projects from ".";

test("project help still routes to the returned changes command", async () => {
  const result = await new Promise<{ error: Error | undefined; output: string }>((resolve) => {
    yargs([])
      .exitProcess(false)
      .command(projects)
      .parse(["projects", "returned-changes", "--help"], (error: Error | undefined, _argv: unknown, output: string) =>
        resolve({ error, output }),
      );
  });
  expect(result.error).toBeUndefined();
  expect(result.output).toContain("returned-changes <id> [action]");
});
