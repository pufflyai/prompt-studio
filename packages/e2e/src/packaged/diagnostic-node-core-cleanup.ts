import { expect } from "bun:test";
import { existsSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { runTestCommand } from "../scripts/run-test-command";

export const removeDiagnosticCore = async (root: string) => {
  const started = Date.now();
  const counts = { files: 0, directories: 0, links: 0, internalLinks: 0, externalLinks: 0, brokenLinks: 0 };
  const canonical = await realpath(root);
  const count = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        counts.links++;
        let target: string;
        try {
          target = await realpath(path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          counts.brokenLinks++;
          continue;
        }
        const within = relative(canonical, target);
        if (within.startsWith("..") || isAbsolute(within)) counts.externalLinks++;
        else counts.internalLinks++;
      } else if (entry.isDirectory()) {
        counts.directories++;
        await count(path);
      } else counts.files++;
    }
  };
  await count(root);
  console.log("Native actual cleanup tree", JSON.stringify({ root, ...counts, inventoryMs: Date.now() - started }));
  const external = mkdtempSync(join(tmpdir(), "pstdio-core-cleanup-sentinel-"));
  const sentinel = join(external, "retained.txt");
  writeFileSync(sentinel, "retained");
  symlinkSync(external, join(root, "external-cleanup-target"), "junction");
  try {
    const removing = Date.now();
    const mode = process.env.E2E_CLEANUP_MODE;
    const operation = mode === "node-sync" ? "rmSync" : "await rm";
    await runTestCommand(
      "node",
      [
        "--input-type=module",
        "-e",
        `import {rm} from "node:fs/promises"; import {rmSync} from "node:fs"; console.error("Native cleanup runtime", JSON.stringify({path:process.execPath,version:process.version,arch:process.arch,pid:process.pid,pool:process.env.UV_THREADPOOL_SIZE??"default"})); const start=Date.now(); ${operation}(process.argv[1],{recursive:true,force:true}); console.error("Native cleanup removal",JSON.stringify({elapsedMs:Date.now()-start,maxRssKiB:process.resourceUsage().maxRSS,rssBytes:process.memoryUsage().rss}));`,
        root,
      ],
      { cwd: tmpdir(), env: { ...process.env, ...(mode === "node-pool64" ? { UV_THREADPOOL_SIZE: "64" } : {}) } },
    );
    expect(existsSync(root)).toBe(false);
    expect(await Bun.file(sentinel).text()).toBe("retained");
    console.log("Native cleanup child closed", JSON.stringify({ elapsedMs: Date.now() - removing, ...counts }));
  } finally {
    await rm(external, { recursive: true, force: true });
  }
};
