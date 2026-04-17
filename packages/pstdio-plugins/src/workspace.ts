import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GITIGNORE_ENTRIES = ["node_modules", "package.json", "package-lock.json", "bun.lock"].join("\n");

type PackageJson = {
  private?: boolean;
  type?: string;
  dependencies?: Record<string, string>;
};

const readPackageJson = (dir: string): PackageJson | null => {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
};

export const detectRuntime = (): "bun" | "npm" => {
  try {
    execFileSync("bun", ["--version"], { stdio: "ignore" });
    return "bun";
  } catch {
    return "npm";
  }
};

const isInstalled = (pstdioDir: string) => existsSync(join(pstdioDir, "node_modules", "@pstdio", "sdk"));

export const ensurePluginWorkspace = async (pstdioDir: string) => {
  const existing = readPackageJson(pstdioDir);
  if (existing?.dependencies?.["@pstdio/sdk"] && isInstalled(pstdioDir)) return;

  if (!existing?.dependencies?.["@pstdio/sdk"]) {
    const pkg: PackageJson = {
      private: true,
      type: "module",
      dependencies: { "@pstdio/sdk": "latest" },
    };

    writeFileSync(join(pstdioDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
    writeFileSync(join(pstdioDir, ".gitignore"), `${GITIGNORE_ENTRIES}\n`);
  }

  const runtime = detectRuntime();
  try {
    if (runtime === "bun") {
      execFileSync("bun", ["install"], { cwd: pstdioDir, stdio: "ignore" });
    } else {
      execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--fund=false"], {
        cwd: pstdioDir,
        stdio: "ignore",
      });
    }
  } catch {
    // Keep local plugin loading available even if SDK installation is unavailable.
  }
};
