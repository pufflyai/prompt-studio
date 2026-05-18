import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { scaffoldBundledPlugins } from "./scaffold-bundled-plugins";

const legacyScheduledHeartbeatPlugin = `import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  schedules: [
    {
      name: "minute-heartbeat",
      cron: "* * * * *",
      timeoutMs: 15_000,
      handler(ctx) {
        console.info(
          \`[plugin:schedule] \${ctx.scheduleName} project=\${ctx.projectId} scheduledFor=\${ctx.scheduledFor} runId=\${ctx.runId}\`,
        );
      },
    },
  ],
});
`;

const bundledPluginsDir = resolve(import.meta.dir, "../../../../../packages/pstdio/files/plugins/pstdio");

const tempDirs: string[] = [];

const createTempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "pstdio-scaffold-bundled-plugins-test-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("scaffoldBundledPlugins", () => {
  test("removes the legacy scheduled heartbeat starter plugin", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    const heartbeatPath = join(pluginsDir, "scheduled-heartbeat.ts");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(heartbeatPath, legacyScheduledHeartbeatPlugin);

    await scaffoldBundledPlugins(repo, bundledPluginsDir);

    expect(existsSync(heartbeatPath)).toBe(false);
    expect(existsSync(join(pluginsDir, "ticket-actions.ts"))).toBe(true);
  });

  test("keeps locally edited files with the old scheduled heartbeat name", async () => {
    const repo = createTempRepo();
    const pluginsDir = join(repo, ".pstdio", "plugins");
    const heartbeatPath = join(pluginsDir, "scheduled-heartbeat.ts");
    mkdirSync(pluginsDir, { recursive: true });
    writeFileSync(heartbeatPath, `${legacyScheduledHeartbeatPlugin}\n// local edit\n`);

    await scaffoldBundledPlugins(repo, bundledPluginsDir);

    expect(readFileSync(heartbeatPath, "utf8")).toContain("// local edit");
  });
});
