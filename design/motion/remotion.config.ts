import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Config } from "@remotion/cli/config";

const require = createRequire(resolve(process.cwd(), "package.json"));

// Temporary bundler workaround: see ADR 0045-temporary-remotion-react-subpath-alias.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      "react/compiler-runtime$": require.resolve("react/compiler-runtime"),
      ...config.resolve?.alias,
    },
  },
}));
