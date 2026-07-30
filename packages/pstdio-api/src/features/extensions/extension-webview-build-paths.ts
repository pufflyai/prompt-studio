import { join } from "node:path";
import { resolvePstdioHome } from "./install-extension-source";

export const defaultWebviewCacheRoot = (env: NodeJS.ProcessEnv) =>
  join(resolvePstdioHome({ env }), "cache", "extension-webviews");
