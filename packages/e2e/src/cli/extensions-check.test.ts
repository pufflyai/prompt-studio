import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
let extensionsRoot: string;

beforeAll(async () => {
  api = await startApi();
  extensionsRoot = join(api.homePath, ".pstdio", "extensions");
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  if (existsSync(extensionsRoot)) {
    rmSync(extensionsRoot, { recursive: true, force: true });
  }
});

const writeExt = (name: string, source: string) => {
  const dir = join(extensionsRoot, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "extension.ts"), source);
};

const runCheck = () => runPstdioSafe("extensions check", process.cwd(), { PSTDIO_API_URL: api.url });

describe("pstdio extensions check (CLI via API)", () => {
  test(
    "reports an empty success when no extensions are installed",
    () => {
      const result = runCheck();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Installed extensions: 0");
      expect(result.stdout).toContain("No extensions found in");
    },
    TEST_TIMEOUT,
  );

  test(
    "lists a valid installed extension",
    () => {
      writeExt(
        "extension-lab",
        `export default {
          id: "pstdio.extension-lab",
          namespace: "lab",
          name: "Extension Lab",
          version: "0.1.0",
          commands: {
            "say-hello": { title: "Say hello", cli: true, run: async () => undefined },
          },
        };`,
      );

      const result = runCheck();

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Installed extensions: 1");
      expect(result.stdout).toContain("Extension Lab");
      expect(result.stdout).toContain("CLI: pstdio lab say-hello");
    },
    TEST_TIMEOUT,
  );

  test(
    "exits 1 with diagnostics for an invalid default export",
    () => {
      writeExt("broken", `export default "nope";`);

      const result = runCheck();

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("invalid_default_export");
    },
    TEST_TIMEOUT,
  );

  test(
    "exits 1 on duplicate CLI paths",
    () => {
      const make = `export default {
        id: "pstdio.dup",
        namespace: "dup",
        name: "Dup",
        commands: {
          "counter.bump": { title: "B", cli: { path: ["counter", "bump"] }, run: async () => undefined },
        },
      };`;
      writeExt("dup-a", make);
      writeExt("dup-b", make);

      const result = runCheck();

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("duplicate_cli_path");
    },
    TEST_TIMEOUT,
  );

  test(
    "exits 1 on unsafe artifact mounts",
    () => {
      writeExt(
        "bad-mount",
        `export default {
          id: "pstdio.bad-mount",
          namespace: "badmount",
          name: "Bad mount",
          artifactMounts: { escape: { path: "../escape", label: "Escape" } },
        };`,
      );

      const result = runCheck();

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("unsafe_artifact_mount_path");
    },
    TEST_TIMEOUT,
  );

  test(
    "exits 1 on invalid middleware command refs",
    () => {
      writeExt(
        "bad-mw",
        `export default {
          id: "pstdio.bad-mw",
          namespace: "badmw",
          name: "Bad mw",
          middlewares: { orphan: { handler: async () => undefined } },
        };`,
      );

      const result = runCheck();

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("invalid_middleware_command");
    },
    TEST_TIMEOUT,
  );

  test(
    "exits 1 on invalid schedule command refs",
    () => {
      writeExt(
        "bad-sched",
        `export default {
          id: "pstdio.bad-sched",
          namespace: "badsched",
          name: "Bad sched",
          schedules: { orphan: { title: "Orphan", cron: "0 * * * *" } },
        };`,
      );

      const result = runCheck();

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain("invalid_schedule_command");
    },
    TEST_TIMEOUT,
  );
});
