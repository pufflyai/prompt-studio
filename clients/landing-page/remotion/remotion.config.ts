import { createRequire } from "node:module";
import { join } from "node:path";
import { Config } from "@remotion/cli/config";

const resolveFrom = createRequire(join(process.cwd(), "remotion.config.ts"));

Config.setStillImageFormat("png");

// Remotion aliases `react` to a single file, which breaks the subpath imports the
// React compiler emits inside @pstdio/ui. Point the subpath at the real module.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      // Longest match does not win in webpack: this has to precede Remotion's `react` alias.
      "react/compiler-runtime": resolveFrom.resolve("react/compiler-runtime"),
      ...config.resolve?.alias,
    },
  },
}));
