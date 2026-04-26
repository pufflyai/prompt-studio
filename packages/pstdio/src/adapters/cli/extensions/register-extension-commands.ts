import { createClient } from "@pstdio/sdk/client";
import { loadPluginRuntime } from "pstdio-plugins/hooks";
import type { Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { topLevelCommandModules } from "../commands";
import { createExtensionCommandModule } from "./command-runner";

const readCommandRoot = (command: string) => command.trim().split(/\s+/)[0]?.trim() ?? "";

const RESERVED_COMMAND_ROOTS = new Set([
  "help",
  "version",
  "$0",
  ...topLevelCommandModules.map((module) => readCommandRoot(module.command ?? "")).filter(Boolean),
]);

const shouldRejectExtensionPath = (pathValue: string) => {
  const root = readCommandRoot(pathValue);
  return RESERVED_COMMAND_ROOTS.has(root);
};

export const registerExtensionCommands = async (cli: Argv) => {
  const cwd = process.cwd();
  const repoPath = findGitRoot(cwd);
  if (!repoPath) return;

  const config = readConfig(repoPath);
  if (!config?.project_id) return;

  const runtime = await loadPluginRuntime({
    repoPath,
    client: createClient(),
  });

  for (const descriptor of runtime.commands.list()) {
    if (shouldRejectExtensionPath(descriptor.path)) continue;

    cli.command(
      createExtensionCommandModule(runtime, config.project_id, descriptor.key, {
        createClient: () => createClient(),
        stdout: console.log,
      }) as never,
    );
  }
};
