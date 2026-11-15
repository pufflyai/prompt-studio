import type { resolveBaseScope } from "./pull-request-ci-scope";

// Diagnostics consume the production planner, but execute only their owning native hosts.
// Source-built diagnostics cannot attest the final signed release bytes.
export const diagnosticScope = (scope: ReturnType<typeof resolveBaseScope>, profile?: string) => {
  let diagnosticPlatform = "";
  if (profile === "windows") diagnosticPlatform = "win32";
  if (profile === "macos") diagnosticPlatform = "darwin";
  if (!diagnosticPlatform && profile !== "compatibility") return { ...scope, diagnosticPlatform };
  const compatibility = profile === "compatibility";
  return {
    ...scope,
    diagnosticPlatform,
    affectedOwners: [],
    packageChecks: false,
    packageMatrix: [],
    lernaFilter: "",
    sharedBuild: "",
    databaseTests: false,
    databaseMatrix: [],
    integrationMatrix: [],
    bunContractMatrix: [],
    componentChecks: false,
    componentMatrix: [],
    appMatrix: [],
    packagedMatrix: [],
    clientMatrix: scope.clientMatrix
      .filter((row) => (compatibility ? row.target === "darwin-x64" : row.platform === diagnosticPlatform))
      .map((row) => ({ ...row, tests: !compatibility })),
    toolchainMatrix: scope.toolchainMatrix.filter((row) => {
      if (compatibility) return ["cli-linux-arm64", "cli-darwin-x64", "cli-win-arm64"].includes(row.platform_pkg);
      return row.platform_pkg.startsWith(diagnosticPlatform === "win32" ? "cli-win-" : "cli-darwin-");
    }),
    quarantineBunOs: scope.quarantineBunOs.filter(
      (os) => !compatibility && os.startsWith(diagnosticPlatform === "win32" ? "windows" : "macos"),
    ),
    harnessMatrix: scope.harnessMatrix.filter(
      (row) =>
        diagnosticPlatform === "win32" && "os" in row && typeof row.os === "string" && row.os.startsWith("windows"),
    ),
    windows: diagnosticPlatform === "win32",
    harnessCli: diagnosticPlatform === "win32",
    dockerBuild: false,
    license: false,
    publishedExtensions: false,
    sdkApiReport: false,
  };
};
