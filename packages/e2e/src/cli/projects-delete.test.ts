import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createProjectViaApi, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]" } });
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const run = (args: string) => runPstdio(args, process.cwd(), { PSTDIO_API_URL: api.url });

const runSafe = (args: string) => runPstdioSafe(args, process.cwd(), { PSTDIO_API_URL: api.url });

describe("pstdio projects delete", () => {
  test(
    "deletes an existing project",
    async () => {
      const project = await createProjectViaApi(api.url, "delete-me");

      const output = run(`projects delete ${project.id}`);

      expect(output).toContain("deleted");

      const listOutput = run("projects list");
      expect(listOutput).not.toContain("delete-me");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for non-existent project",
    () => {
      const result = runSafe("projects delete nonexistent-id");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Project not found");
    },
    TEST_TIMEOUT,
  );
});
