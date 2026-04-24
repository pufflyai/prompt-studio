import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const isCompiledBinary = () => {
  const embeddedFiles = (Bun as Record<string, unknown>).embeddedFiles;
  return Array.isArray(embeddedFiles) && embeddedFiles.length > 0;
};

const sdkExtensionsPath = () => Bun.resolveSync("@pstdio/sdk/extensions", import.meta.dir);

const importBundledExtensionModule = async (filePath: string) => {
  const tempDir = mkdtempSync(join(tmpdir(), "pstdio-extension-build-"));

  try {
    const result = await Bun.build({
      entrypoints: [filePath],
      outdir: tempDir,
      naming: "[name].js",
      format: "esm",
      target: "bun",
      plugins: [
        {
          name: "pstdio-sdk-extensions-resolver",
          setup(build) {
            build.onResolve({ filter: /^@pstdio\/sdk\/extensions$/ }, () => ({ path: sdkExtensionsPath() }));
          },
        },
      ],
    });

    if (!result.success) {
      const detail = result.logs.map((log) => log.message).join("; ");
      throw new Error(`Failed to bundle extension module: ${filePath}${detail ? `: ${detail}` : ""}`);
    }

    return await import(pathToFileURL(join(tempDir, "extension.js")).href);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

export const importExtensionModule = async (filePath: string) => {
  if (isCompiledBinary()) {
    return importBundledExtensionModule(filePath);
  }

  try {
    const version = statSync(filePath).mtimeMs;
    return await import(`${pathToFileURL(filePath).href}?mtime=${version}`);
  } catch {
    return importBundledExtensionModule(filePath);
  }
};
