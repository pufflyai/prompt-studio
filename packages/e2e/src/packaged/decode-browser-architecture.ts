import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const root = join(
  import.meta.dirname,
  "../../../../.pstdio/extension-storage/pstdio.pstdio-artifacts/browser-architecture",
);
const channel = process.env.E2E_QUALIFY_BROWSER_CHANNEL!;
const path = join(root, `${channel}.jsonl`);
if (!existsSync(path)) {
  console.log("No launched browser metadata is available; architecture remains unknown.");
  process.exit(0);
}
const records = (await Bun.file(path).text())
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const vswhere = join(process.env["ProgramFiles(x86)"]!, "Microsoft Visual Studio/Installer/vswhere.exe");
let dumpbin: string | undefined;
if (existsSync(vswhere)) {
  const result = Bun.spawnSync([vswhere, "-latest", "-products", "*", "-property", "installationPath"]);
  const installation = result.stdout.toString().trim();
  if (installation) {
    for (const host of ["Hostarm64/arm64", "Hostx64/x64"]) {
      const found = [
        ...new Bun.Glob(`VC/Tools/MSVC/*/bin/${host}/dumpbin.exe`).scanSync({ cwd: installation, absolute: true }),
      ]
        .sort()
        .reverse();
      if (found[0]) {
        dumpbin = found[0];
        break;
      }
    }
  }
}
if (!dumpbin) {
  console.log("Visual Studio dumpbin is unavailable; raw PE machine values do not establish ARM64EC content.");
  process.exit(0);
}
console.log(`Architecture decoder: ${dumpbin}`);
const version = Bun.spawnSync([dumpbin]);
console.log(version.stdout.toString().split("\n").slice(0, 3).join("\n"));
const files = new Set<string>();
for (const record of records) {
  files.add(record.path);
  const directory = dirname(record.path);
  if (basename(record.path).toLowerCase() === "msedge.exe") {
    const edgeVersion = /Edg\/([\d.]+)/.exec(record.cdpVersion.userAgent)?.[1];
    const engine = edgeVersion ? join(directory, edgeVersion, "msedge.dll") : null;
    if (engine && existsSync(engine)) files.add(engine);
    else console.log(`The loaded Edge engine version was not resolved: ${JSON.stringify(record.cdpVersion)}`);
  } else {
    const engine = join(directory, "chrome.dll");
    if (existsSync(engine)) files.add(engine);
  }
}
let index = 0;
for (const file of files) {
  const result = Bun.spawnSync([dumpbin, "/headers", file]);
  const output = result.stdout.toString() + result.stderr.toString();
  console.log(`Decoded browser image: ${file}\n${output}`);
  await Bun.write(join(root, `${index++}-${basename(file)}-headers.txt`), output);
  if (result.exitCode !== 0) throw new Error(`dumpbin failed for ${file}`);
}
