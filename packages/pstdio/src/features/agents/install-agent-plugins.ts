import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { join } from "node:path";
import { resolveFilesRoot } from "@/features/resolve-files-root";

type InstallPluginsOptions = {
  root: string;
  agentId: string;
  global?: boolean;
  homedir?: string;
};

const OPENCODE_LOCAL_PLUGINS_DIR = ".opencode/plugins";
const OPENCODE_GLOBAL_PLUGINS_DIR = ".opencode/plugins";

export const OPENCODE_SESSION_BRIDGE_PLUGIN_FILE = "pstdio-session-bridge.js";

export const doesAgentRequirePlugins = (agentId: string) => agentId === "opencode";

const resolvePluginsDir = (options: InstallPluginsOptions) => {
  const home = options.homedir ?? defaultHomedir();

  if (options.global) {
    return join(home, OPENCODE_GLOBAL_PLUGINS_DIR);
  }

  return join(options.root, OPENCODE_LOCAL_PLUGINS_DIR);
};

const resolveSourcePluginPath = async () => {
  const filesRoot = await resolveFilesRoot();
  return join(filesRoot, "plugins", "opencode", OPENCODE_SESSION_BRIDGE_PLUGIN_FILE);
};

export const installPluginsForAgent = async (options: InstallPluginsOptions) => {
  if (!doesAgentRequirePlugins(options.agentId)) {
    return [] as string[];
  }

  const source = await resolveSourcePluginPath();
  const targetDir = resolvePluginsDir(options);
  const target = join(targetDir, OPENCODE_SESSION_BRIDGE_PLUGIN_FILE);

  if (!existsSync(source)) {
    throw new Error(`Missing bundled plugin artifact: ${source}`);
  }

  if (existsSync(target)) {
    return [] as string[];
  }

  mkdirSync(targetDir, { recursive: true });
  cpSync(source, target);

  return [OPENCODE_SESSION_BRIDGE_PLUGIN_FILE];
};
