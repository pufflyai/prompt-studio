import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionOwner } from "./supervisor";

// Windows tree termination needs its own native lifecycle evidence; this exercises POSIX process groups.
test.skipIf(process.platform === "win32")(
  "an exiting owner also terminates children left in its process group",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-owner-child-exit-"));
    const marker = join(root, "child-pid");
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "children",
        version: "1.0.0",
        publisher: "test",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    writeFileSync(
      join(root, "extension.ts"),
      `import { writeFileSync } from 'node:fs';
    const child = Bun.spawn([process.execPath, '-e', 'setInterval(() => {}, 1000)'], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' });
    writeFileSync(${JSON.stringify(marker)}, String(child.pid));
    export default { commands: [{ id: 'exit', run: () => process.exit(1) }] };`,
    );
    const owner = createExtensionOwner({ path: root });
    let childPid: number | undefined;
    const alive = () => {
      try {
        process.kill(childPid!, 0);
        return true;
      } catch {
        return false;
      }
    };
    try {
      const source = await owner.load();
      childPid = Number(readFileSync(marker, "utf8"));
      expect(childPid).toBeGreaterThan(0);
      await expect(Promise.resolve(source!.definition.commands![0]!.run({} as never, {}))).rejects.toMatchObject({
        code: "extension_owner_exited",
      });
      const startedAt = performance.now();
      while (alive() && performance.now() - startedAt < 1000) await Bun.sleep(5);
      expect(alive()).toBe(false);
    } finally {
      if (childPid && alive()) process.kill(childPid, "SIGKILL");
      await owner.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  },
);
