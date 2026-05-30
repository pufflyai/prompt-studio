import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type PlatformBinary = { pkg: string; bin: string };

type SmokeFixture = {
  rootDir: string;
  extensionDir: string;
  cacheDir: string;
  outfile: string;
};

type SmokeCommand = {
  binPath: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
};

export const getHostPlatformPackage = (
  platformBinaries: PlatformBinary[],
  packageOverride = process.env.PSTDIO_VERIFY_PLATFORM_PKG,
) => {
  if (packageOverride) {
    const platformPackage = platformBinaries.find((binary) => binary.pkg === packageOverride);
    if (!platformPackage) {
      throw new Error(`No packaged pstdio binary is configured for PSTDIO_VERIFY_PLATFORM_PKG=${packageOverride}`);
    }

    return platformPackage;
  }

  const os = process.platform === "win32" ? "win" : process.platform;
  const pkg = `cli-${os}-${process.arch}`;
  const platformPackage = platformBinaries.find((binary) => binary.pkg === pkg);

  if (!platformPackage) {
    throw new Error(
      `No packaged pstdio binary is configured for this host platform: ${process.platform}-${process.arch}`,
    );
  }

  return platformPackage;
};

export const resolveCompiledBinaryPath = (platformPackage: PlatformBinary) =>
  resolve("./packages/pstdio/dist/platforms", platformPackage.pkg, "bin", platformPackage.bin);

export const createCompiledBunSmokeFixture = (rootDir = mkdtempSync(join(tmpdir(), "pstdio-compiled-bun-"))) => {
  const extensionDir = join(rootDir, "extension");
  const cacheDir = join(rootDir, "bun-cache");
  const localDepDir = join(extensionDir, "local-dep");
  const srcDir = join(extensionDir, "src");
  const outfile = join(extensionDir, "dist", "entry.js");

  mkdirSync(srcDir, { recursive: true });
  mkdirSync(localDepDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    join(extensionDir, "package.json"),
    `${JSON.stringify({ name: "compiled-bun-smoke", private: true, dependencies: { "local-dep": "file:./local-dep" } })}\n`,
  );
  writeFileSync(join(localDepDir, "package.json"), `${JSON.stringify({ name: "local-dep", version: "1.0.0" })}\n`);
  writeFileSync(join(srcDir, "entry.ts"), "export const answer = 42;\n");

  return { rootDir, extensionDir, cacheDir, outfile };
};

export const buildCompiledBunSmokePlan = ({ binPath, fixture }: { binPath: string; fixture: SmokeFixture }) => {
  const env = {
    ...process.env,
    BUN_BE_BUN: "1",
    BUN_INSTALL_CACHE_DIR: fixture.cacheDir,
  };

  return {
    install: {
      binPath,
      args: ["install", "--ignore-scripts"],
      cwd: fixture.extensionDir,
      env,
    },
    build: {
      binPath,
      args: [
        "build",
        join(fixture.extensionDir, "src", "entry.ts"),
        "--target=browser",
        "--format=esm",
        "--outfile",
        fixture.outfile,
      ],
      cwd: fixture.extensionDir,
      env,
    },
  };
};

const runSmokeCommand = (label: string, command: SmokeCommand) => {
  const result = spawnSync(command.binPath, command.args, {
    cwd: command.cwd,
    env: command.env,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Compiled binary failed BUN_BE_BUN ${label} smoke with status ${result.status ?? "unknown"}.`,
        `Command: ${command.binPath} ${command.args.join(" ")}`,
        `Cwd: ${command.cwd}`,
        `stdout:\n${result.stdout}`,
        `stderr:\n${result.stderr}`,
      ].join("\n"),
    );
  }
};

export const runCompiledBunSmoke = (platformBinaries: PlatformBinary[]) => {
  const platformPackage = getHostPlatformPackage(platformBinaries);
  const binPath = resolveCompiledBinaryPath(platformPackage);
  const fixture = createCompiledBunSmokeFixture();
  const plan = buildCompiledBunSmokePlan({ binPath, fixture });

  try {
    runSmokeCommand("install", plan.install);
    if (!existsSync(join(fixture.extensionDir, "bun.lock"))) {
      throw new Error("Compiled binary install smoke completed without writing bun.lock.");
    }

    runSmokeCommand("build", plan.build);
    if (!existsSync(fixture.outfile)) {
      throw new Error(`Compiled binary build smoke completed without writing ${fixture.outfile}.`);
    }

    const bundledOutput = readFileSync(fixture.outfile, "utf8");
    if (!bundledOutput.includes("answer")) {
      throw new Error(`Compiled binary build smoke wrote unexpected output to ${fixture.outfile}.`);
    }

    process.stdout.write(`OK: ${binPath} runs Bun install/build with BUN_BE_BUN=1\n`);
  } finally {
    rmSync(fixture.rootDir, { recursive: true, force: true });
  }
};
