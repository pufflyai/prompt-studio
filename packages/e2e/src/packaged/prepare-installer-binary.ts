import { createHash } from "node:crypto";
import { appendFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const version = process.env.PS932_INSTALL_VERSION;
const digests: Record<string, string> = {
  "1.4.3": "5e8f142ef722cbc9f67dc068a166e46ee72be8307b38cac7186589d2face668f",
  "1.4.4": "2d57a0eec0cb44d95c918c3f9734f60455a1306ae5085d76fc68f44e3ee30d09",
};
if (!version || !digests[version]) throw new Error("A pinned diagnostic installer is required");
const root = await mkdtemp(join(tmpdir(), "ps-932-installer-runtime-"));
const zip = join(root, "runtime.zip");
const url = `https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-windows-aarch64.zip`;
const response = await fetch(url);
if (!response.ok) throw new Error(`Runtime download failed: ${response.status}`);
await Bun.write(zip, response);
const sha256 = createHash("sha256")
  .update(await Bun.file(zip).bytes())
  .digest("hex");
if (sha256 !== digests[version]) throw new Error("Runtime archive digest differs from the official release asset");
const extractor = Bun.spawn(
  [
    "powershell.exe",
    "-NoProfile",
    "-Command",
    "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:PS932_RUNTIME_ZIP -DestinationPath $env:PS932_RUNTIME_ROOT",
  ],
  {
    env: { ...process.env, PS932_RUNTIME_ZIP: zip, PS932_RUNTIME_ROOT: root },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  },
);
const [extractExit, stdout, stderr] = await Promise.all([
  extractor.exited,
  new Response(extractor.stdout).text(),
  new Response(extractor.stderr).text(),
]);
if (extractExit !== 0) throw new Error(`Runtime extraction failed: ${stdout} ${stderr}`);
const binary = join(root, "bun-windows-aarch64", "bun.exe");
const header = Buffer.from(await Bun.file(binary).slice(0, 4096).arrayBuffer());
const offset = header.readUInt32LE(0x3c);
if (header.toString("binary", offset, offset + 4) !== "PE\0\0") throw new Error("Runtime is not a PE executable");
const machine = header.readUInt16LE(offset + 4);
if (machine !== 0xaa64) throw new Error(`Runtime machine is not ARM64: ${machine.toString(16)}`);
const child = Bun.spawn(
  [binary, "-p", "JSON.stringify({version:Bun.version,revision:Bun.revision,arch:process.arch})"],
  {
    env: { ...process.env },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  },
);
const [exitCode, identityText, identityError] = await Promise.all([
  child.exited,
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
]);
if (exitCode !== 0) throw new Error(`Runtime identity failed: ${identityError}`);
const identity = JSON.parse(identityText);
if (identity.version !== version || identity.arch !== "arm64")
  throw new Error("Runtime identity differs from the pinned native installer");
await writeFile(join(root, "identity.json"), JSON.stringify({ url, sha256, binary, machine, identity }, null, 2));
if (!process.env.GITHUB_ENV) throw new Error("Job environment output is required");
await appendFile(process.env.GITHUB_ENV, `PS932_INSTALL_BINARY=${binary}\n`);
console.log(JSON.stringify({ url, sha256, machine, identity }));
