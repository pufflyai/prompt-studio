"use strict";

function resolvePackageName(platform, arch) {
  if (platform === "darwin" && arch === "arm64") return "@pstdio/cli-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "@pstdio/cli-darwin-x64";
  if (platform === "linux" && arch === "x64") return "@pstdio/cli-linux-x64";
  if (platform === "linux" && arch === "arm64") return "@pstdio/cli-linux-arm64";
  if (platform === "win32" && arch === "x64") return "@pstdio/cli-win-x64";
  if (platform === "win32" && arch === "arm64") return "@pstdio/cli-win-arm64";
  return null;
}

module.exports = { resolvePackageName };
