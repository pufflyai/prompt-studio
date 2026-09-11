import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Temporary bootstrap for the Playwright image, which lacks unzip. See ADR 0026.
const { packageManager } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  packageManager: string;
};
const version = packageManager.slice("bun@".length);
const response = await fetch(`https://registry.npmjs.org/@oven/bun-linux-x64/-/bun-linux-x64-${version}.tgz`);
if (!response.ok) throw new Error(`Bun ${version} download failed: HTTP ${response.status}`);

const directory = mkdtempSync(join(tmpdir(), "pstdio-ci-bun-"));
const archive = join(directory, "bun.tgz");
writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
execFileSync("tar", ["-xzf", archive, "-C", directory]);
rmSync(archive);

const bin = join(directory, "package", "bin");
const installedVersion = execFileSync(join(bin, "bun"), ["--version"], { encoding: "utf8" }).trim();
if (installedVersion !== version) throw new Error(`Expected Bun ${version}, received ${installedVersion}`);
symlinkSync("bun", join(bin, "bunx"));
appendFileSync(process.env.GITHUB_PATH!, `${bin}\n`);
console.log(`Installed Bun ${installedVersion} from its registry archive`);
