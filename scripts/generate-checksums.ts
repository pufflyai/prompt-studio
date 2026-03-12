import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BINARIES = [
  { pkg: "cli-darwin-arm64", bin: "pstdio", asset: "pstdio-darwin-arm64" },
  { pkg: "cli-darwin-x64", bin: "pstdio", asset: "pstdio-darwin-x64" },
  { pkg: "cli-linux-x64", bin: "pstdio", asset: "pstdio-linux-x64" },
  { pkg: "cli-linux-arm64", bin: "pstdio", asset: "pstdio-linux-arm64" },
  { pkg: "cli-linux-x64-musl", bin: "pstdio", asset: "pstdio-linux-x64-musl" },
  { pkg: "cli-linux-arm64-musl", bin: "pstdio", asset: "pstdio-linux-arm64-musl" },
  { pkg: "cli-win-x64", bin: "pstdio.exe", asset: "pstdio-win-x64.exe" },
  { pkg: "cli-win-arm64", bin: "pstdio.exe", asset: "pstdio-win-arm64.exe" },
];

const checksumLines: string[] = [];

for (const { pkg, bin, asset } of BINARIES) {
  const binPath = join("./packages/pstdio/dist/platforms", pkg, "bin", bin);
  const content = readFileSync(binPath);
  const h = new Bun.CryptoHasher("sha256");
  h.update(content);
  checksumLines.push(`${h.digest("hex")}  ${asset}`);
}

const outPath = "./packages/pstdio/dist/platforms/checksums.sha256";
writeFileSync(outPath, `${checksumLines.join("\n")}\n`);

console.log(`Checksums written to ${outPath}:`);
for (const line of checksumLines) {
  console.log(`  ${line}`);
}
