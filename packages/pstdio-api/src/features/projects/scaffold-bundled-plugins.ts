import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { discoverPluginFiles } from "pstdio-plugins";
import { scaffoldBundledFiles } from "./scaffold-bundled-files";

const EMBEDDED_PLUGINS_PREFIX = "../files/plugins/pstdio/";
const legacyScheduledHeartbeatPath = "scheduled-heartbeat.ts";
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

const stripTemplateSuffix = (filename: string) => {
  if (!filename.endsWith(".txt")) return filename;
  const stripped = filename.slice(0, -4);
  return stripped.includes(".") ? stripped : filename;
};

const normalizeLegacyPlugin = (value: string) => value.replaceAll("\r\n", "\n").trim();

const removeLegacyScheduledHeartbeatPlugin = (pluginsDir: string) => {
  const legacyPath = join(pluginsDir, legacyScheduledHeartbeatPath);
  if (!existsSync(legacyPath)) return;

  const current = readFileSync(legacyPath, "utf8");
  if (normalizeLegacyPlugin(current) === normalizeLegacyPlugin(legacyScheduledHeartbeatPlugin)) {
    unlinkSync(legacyPath);
  }
};

export const scaffoldBundledPlugins = async (repoPath: string, bundledPluginsDir: string) => {
  const pluginsDir = join(repoPath, ".pstdio", "plugins");

  removeLegacyScheduledHeartbeatPlugin(pluginsDir);

  await scaffoldBundledFiles(pluginsDir, {
    bundledSourceDir: bundledPluginsDir,
    embeddedPrefix: EMBEDDED_PLUGINS_PREFIX,
    transformName: stripTemplateSuffix,
    allowExistingTarget: discoverPluginFiles(pluginsDir).length === 0,
  });
};
