import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createProjectViaApi, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

const FIXTURE_SOURCE = `const COUNTER_KEY = "counter";

export default {
  id: "pstdio.lab",
  namespace: "lab",
  name: "Lab",
  commands: {
    "counter.bump": {
      title: "Bump counter",
      cli: true,
      async run(ctx) {
        const current = (await ctx.storage.get(COUNTER_KEY)) ?? 0;
        const amount = Number(ctx.params.amount ?? 1);
        const next = current + amount;
        await ctx.storage.set(COUNTER_KEY, next);
        return { counter: next };
      },
    },
    "counter.read": {
      title: "Read counter",
      cli: true,
      async run(ctx) {
        return { counter: (await ctx.storage.get(COUNTER_KEY)) ?? 0 };
      },
    },
    awaken: {
      title: "Awaken",
      cli: true,
      async run() {
        return { awakened: true };
      },
    },
  },
  middlewares: {
    rejectAwaken: {
      command: "lab.awaken",
      async handler(ctx) {
        const title = String(ctx.params.title ?? "");
        if (title.toUpperCase().includes("DOOM")) {
          return ctx.commands.reject({
            code: "doom_rejected",
            reason: "title contains DOOM",
          });
        }
      },
    },
  },
};
`;

let api: ApiInstance;
const dirs: string[] = [];

beforeAll(async () => {
  api = await startApi();
  const labDir = join(api.homePath, ".pstdio", "extensions", "lab");
  mkdirSync(labDir, { recursive: true });
  writeFileSync(join(labDir, "extension.ts"), FIXTURE_SOURCE);
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

const cliEnv = () => ({ PSTDIO_API_URL: api.url, HOME: api.homePath });

describe("pstdio extension command execution (e2e)", () => {
  test(
    "executes a command, persists state, and reports JSON output",
    async () => {
      const project = await createProjectViaApi(api.url, "ext-exec");
      const repo = createGitRepo();
      dirs.push(repo);
      runPstdio(`projects link --project-id ${project.id}`, repo, cliEnv());

      const first = runPstdio("lab counter bump --amount 2", repo, cliEnv());
      expect(first).toContain("Command lab.counter.bump completed");
      expect(first).toContain('"counter": 2');

      const read = runPstdio("lab counter read", repo, cliEnv());
      expect(read).toContain('"counter": 2');
    },
    TEST_TIMEOUT,
  );

  test(
    "middleware rejection exits with non-zero status",
    async () => {
      const project = await createProjectViaApi(api.url, "ext-reject");
      const repo = createGitRepo();
      dirs.push(repo);
      runPstdio(`projects link --project-id ${project.id}`, repo, cliEnv());

      const result = runPstdioSafe('lab awaken --title "DOOM rises"', repo, cliEnv());
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain("rejected");
      expect(result.stdout).toContain("doom_rejected");
    },
    TEST_TIMEOUT,
  );
});
