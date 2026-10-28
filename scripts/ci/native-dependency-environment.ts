import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

export const nativeDependencyEnvironment = (cwd: string, env: NodeJS.ProcessEnv = process.env) => {
  const nativeEnv: NodeJS.ProcessEnv = {
    ...env,
    npm_config_node_gyp: join(cwd, "node_modules", "node-gyp", "bin", "node-gyp.js"),
  };
  if (process.platform === "win32" || env.npm_config_nodedir) return nativeEnv;
  const node = Bun.which("node", { PATH: env.PATH });
  if (!node) return nativeEnv;
  const nodeRoot = dirname(dirname(realpathSync.native(node)));
  if (existsSync(join(nodeRoot, "include", "node", "node.h"))) nativeEnv.npm_config_nodedir = nodeRoot;
  return nativeEnv;
};
