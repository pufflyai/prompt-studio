import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

const LAB_FIXTURE = `export default {
  id: "pstdio.extension-lab",
  namespace: "lab",
  name: "Extension Lab",
  commands: {
    "say-hello": {
      title: "Say hello",
      description: "Print a lab greeting.",
      cli: { description: "Print a lab greeting.", examples: ["pstdio lab say-hello"] },
      run: async () => ({ message: "hello" }),
    },
    "counter.bump": {
      title: "Bump counter",
      description: "Increment the lab counter.",
      cli: { description: "Increment the lab counter.", examples: ["pstdio lab counter bump --amount 2"] },
      run: async () => ({ counter: 1 }),
    },
    "internal.heartbeat": {
      title: "Internal heartbeat",
      cli: false,
      commandPanel: false,
      run: async () => undefined,
    },
  },
};
`;

const TICKETS_COLLISION_FIXTURE = `export default {
  id: "acme.tickets-collision",
  namespace: "tickets",
  name: "Conflicting Tickets",
  commands: {
    list: {
      title: "List tickets",
      cli: true,
      run: async () => ({ tickets: [] }),
    },
  },
};
`;

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();

  const labDir = join(api.homePath, ".pstdio", "extensions", "extension-lab");
  mkdirSync(labDir, { recursive: true });
  writeFileSync(join(labDir, "extension.ts"), LAB_FIXTURE);
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const cliEnv = (overrides: Record<string, string> = {}) => ({
  PSTDIO_API_URL: api.url,
  HOME: api.homePath,
  ...overrides,
});

describe("pstdio CLI router (e2e)", () => {
  test(
    "namespace help shows provider and lists CLI-exposed commands",
    () => {
      const result = runPstdioSafe("lab --help", process.cwd(), cliEnv());
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Extension namespace: lab");
      expect(result.stdout).toContain("Provider: pstdio.extension-lab");
      expect(result.stdout).toContain("counter");
      expect(result.stdout).toContain("say-hello");
      expect(result.stdout).not.toContain("internal.heartbeat");
    },
    TEST_TIMEOUT,
  );

  test(
    "command help shows provider, command id, and examples",
    () => {
      const result = runPstdioSafe("lab counter bump --help", process.cwd(), cliEnv());
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("pstdio.extension-lab");
      expect(result.stdout).toContain("lab.counter.bump");
      expect(result.stdout).toContain("pstdio lab counter bump --amount 2");
    },
    TEST_TIMEOUT,
  );

  test(
    "missing first-party planner command prints recovery message",
    () => {
      const result = runPstdioSafe("planner tickets pull", process.cwd(), cliEnv());
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toContain("Command not found: pstdio planner tickets pull");
      expect(result.stdout).toContain("pstdio.planner");
      expect(result.stdout).toContain("pstdio extensions add planner");
    },
    TEST_TIMEOUT,
  );

  test(
    "static/extension namespace collision drops the extension namespace and reports a diagnostic",
    () => {
      const ticketsDir = join(api.homePath, ".pstdio", "extensions", "tickets-collision");
      mkdirSync(ticketsDir, { recursive: true });
      writeFileSync(join(ticketsDir, "extension.ts"), TICKETS_COLLISION_FIXTURE);

      const result = runPstdioSafe("tickets list", process.cwd(), cliEnv());
      expect(result.stderr).toContain("cli_path_collision");
      expect(result.stderr).toContain("pstdio tickets list");
      expect(result.stderr).toContain("acme.tickets-collision");
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );
});
