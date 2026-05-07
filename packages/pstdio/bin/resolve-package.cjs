"use strict";

function detectLinuxLibc() {
  if (process.platform !== "linux") return null;
  if (!process.report || typeof process.report.getReport !== "function") return "glibc";
  const report = process.report.getReport();
  return report.header?.glibcVersionRuntime ? "glibc" : "musl";
}

function resolvePackageName(platform, arch, libc = platform === "linux" ? detectLinuxLibc() : null) {
  if (platform === "darwin" && arch === "arm64") return "@pstdio/cli-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "@pstdio/cli-darwin-x64";
  if (platform === "linux" && libc === "musl") return null;
  if (platform === "linux" && arch === "x64") return "@pstdio/cli-linux-x64";
  if (platform === "linux" && arch === "arm64") return "@pstdio/cli-linux-arm64";
  if (platform === "win32" && arch === "x64") return "@pstdio/cli-win-x64";
  if (platform === "win32" && arch === "arm64") return "@pstdio/cli-win-arm64";
  return null;
}

module.exports = { detectLinuxLibc, resolvePackageName };
