import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeDependencyEnvironment } from "./native-dependency-environment";

test("an explicit native header directory remains configured", () => {
  const env = { PATH: "", npm_config_nodedir: join(tmpdir(), "custom-node-headers") };
  expect(nativeDependencyEnvironment("workspace", env).npm_config_nodedir).toBe(env.npm_config_nodedir);
});

test("dependency installation can proceed without a Node executable", () => {
  expect(nativeDependencyEnvironment("workspace", { PATH: "" }).npm_config_nodedir).toBeUndefined();
});

test.skipIf(process.platform === "win32")(
  "header reuse is optional when the Node installation lacks headers",
  async () => {
    const cwd = realpathSync.native(mkdtempSync(join(tmpdir(), "pstdio-node-headers-")));
    try {
      const node = join(cwd, "bin", "node");
      await Bun.write(node, "");
      chmodSync(node, 0o755);
      expect(nativeDependencyEnvironment(cwd, { PATH: join(cwd, "bin") }).npm_config_nodedir).toBeUndefined();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
);

test.skipIf(process.platform === "win32")("headers follow the real Node installation behind a symlink", async () => {
  const cwd = realpathSync.native(mkdtempSync(join(tmpdir(), "pstdio-node-headers-")));
  try {
    const installation = join(cwd, "node-installation");
    const node = join(installation, "bin", "node");
    await Bun.write(node, "");
    chmodSync(node, 0o755);
    await Bun.write(join(installation, "include", "node", "node.h"), "");
    const launcher = join(cwd, "bin", "node");
    await Bun.write(join(cwd, "bin", ".keep"), "");
    symlinkSync(node, launcher);
    expect(nativeDependencyEnvironment(cwd, { PATH: join(cwd, "bin") }).npm_config_nodedir).toBe(installation);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
