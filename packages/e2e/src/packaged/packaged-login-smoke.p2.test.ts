import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stopChildProcess } from "../scripts/child-process";
import { waitForProcessReady } from "../scripts/process-readiness";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";
import { startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { setupPackagedSmokeTests } from "./packaged-smoke-setup";
import { PACKAGED_TEST_TIMEOUT } from "./packaged-test-timeout";

setupPackagedSmokeTests();

test.each([
  { name: "hosted default", environment: "", args: [], expected: "https://base.prompt.studio/accounts" },
  {
    name: "host environment",
    environment: "https://dev.fixture.test/accounts/",
    args: [],
    expected: "https://dev.fixture.test/accounts",
  },
  {
    name: "explicit service",
    environment: "https://dev.fixture.test/accounts",
    args: ["--manager", "https://self.fixture.test/auth/"],
    expected: "https://self.fixture.test/auth",
  },
])(
  "compiled login uses $name",
  async ({ environment, args, expected }) => {
    const root = mkdtempSync(join(tmpdir(), "packaged-login-"));
    const host = await startPackagedServe(root, {
      ...(environment ? { PSTDIO_ACCOUNT_MANAGER_ORIGIN: environment } : {}),
    });
    const cli = spawn(PACKAGED_BINARY_PATH, ["login", "--open-browser=false", ...args], {
      cwd: root,
      env: {
        ...process.env,
        PSTDIO_HOME: root,
        PSTDIO_API_URL: host.baseUrl,
        PSTDIO_API_TOKEN: host.descriptor.token,
        PSTDIO_DISABLE_API_AUTO_START: "1",
        // The host, rather than the CLI process, owns the environment override.
        PSTDIO_ACCOUNT_MANAGER_ORIGIN: "https://wrong.fixture.test",
      },
      stdio: "pipe",
    });
    let output = "";
    cli.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    try {
      const url = await waitForProcessReady(cli, "Packaged login", async () => {
        const match = output.match(/Log in at (https:\/\/\S+)/);
        if (match) return new URL(match[1]!);
      });
      expect(`${url.origin}${url.pathname}`).toBe(`${expected}/v1/native-login`);
      expect(new URL(url.searchParams.get("callback")!).hostname).toBe("127.0.0.1");
    } finally {
      await stopChildProcess(cli);
      await stopProcess(host.child);
      rmSync(root, { recursive: true, force: true });
    }
  },
  PACKAGED_TEST_TIMEOUT,
);
