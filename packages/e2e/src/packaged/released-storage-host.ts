import { createHash } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Published checksums for pstdio@0.45.0, the last release before the 0.46 database baseline.
const checksums: Record<string, string> = {
  "pstdio-darwin-arm64": "e13a673906a4c0464b1a3d8c01244756862db8db2b3a678a5162b88782c10a74",
  "pstdio-darwin-x64": "dffe84f482d28cd29004775cd0e4a2459ee0a2b0140745b581203f164b33a711",
  "pstdio-linux-x64": "600585536c61e0208de4bbcca68fd28f4c1f4b08abbe5945bd5f27d1529ae7d2",
  "pstdio-linux-arm64": "762b659cf4b2ffbccdcdbd5bd91ef0ada9d6a9367927369ecb4257cd1b0426d1",
  "pstdio-win-x64.exe": "5647b70c92abb4117a705b8c6e0e499d10d26c8158959839686a7a862b2b2b3a",
  "pstdio-win-arm64.exe": "4ed995570f426e74d1f3c811dcf8f6c818e9858efc008d11ebb1566ab80c3a19",
};

export const prepareReleasedStorageHost = async () => {
  const platform = process.platform === "win32" ? "win" : process.platform;
  const name = `pstdio-${platform}-${process.arch}${process.platform === "win32" ? ".exe" : ""}`;
  const expected = checksums[name];
  if (!expected) throw new Error(`No released storage host for ${name}`);
  const directory = join(tmpdir(), "pstdio-upgrade-045");
  await mkdir(directory, { recursive: true });
  const path = join(directory, name);
  if (!(await Bun.file(path).exists())) {
    const response = await fetch(`https://github.com/pufflyai/prompt-studio/releases/download/pstdio%400.45.0/${name}`);
    if (!response.ok) throw new Error(`Cannot download released storage host: HTTP ${response.status}`);
    await Bun.write(path, response);
  }
  const actual = createHash("sha256")
    .update(new Uint8Array(await Bun.file(path).arrayBuffer()))
    .digest("hex");
  if (actual !== expected) throw new Error(`Released storage host checksum mismatch: ${name}`);
  await chmod(path, 0o700);
  return path;
};
