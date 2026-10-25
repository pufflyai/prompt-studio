import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const [path, output] = process.argv.slice(2);
if (!path || !output) throw new Error("Pass the built image archive and output identity paths");
const hash = createHash("sha256");
for await (const chunk of createReadStream(path)) hash.update(chunk);
const sha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
if (sha.status !== 0) throw new Error("Cannot read the built service revision");
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync(
  output,
  JSON.stringify(
    {
      sourceSha: process.env.SOURCE_SHA,
      versionSha: sha.stdout.trim(),
      toolchain: String(manifest.packageManager).replace("bun@", "bun-"),
      payloadName: basename(path),
      payloadDigest: hash.digest("hex"),
    },
    null,
    2,
  ),
);
